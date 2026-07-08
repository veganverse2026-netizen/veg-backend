import { prisma } from "../../infrastructure/db/prisma.js";
import { getIo } from "../../infrastructure/realtime/socket.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { createNotification } from "../notifications/notifications.service.js";

const MAX_FEED_POSTS = 50;

const flatCommentInclude = {
  user: { select: { name: true } },
  likes: true
};

type FlatComment = { id: string; parentId: string | null; [key: string]: unknown };

// Comments can be replied to at any depth. Prisma can't express an
// arbitrary-depth recursive `include`, so we fetch every comment for the
// post(s) flat (ordered oldest-first) and reassemble the reply tree here.
function buildCommentTree<T extends FlatComment>(flat: T[]): (T & { replies: unknown[] })[] {
  const byId = new Map<string, T & { replies: unknown[] }>();
  for (const c of flat) byId.set(c.id, { ...c, replies: [] });

  const roots: (T & { replies: unknown[] })[] = [];
  for (const c of byId.values()) {
    if (c.parentId) {
      const parent = byId.get(c.parentId);
      // Parent should always be present since it belongs to the same post,
      // but fall back to treating it as a root rather than dropping it.
      if (parent) parent.replies.push(c);
      else roots.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

export async function getFeed(limit = MAX_FEED_POSTS) {
  const posts = await prisma.post.findMany({
    take: Math.max(1, Math.min(MAX_FEED_POSTS, limit)),
    include: {
      user: { select: { id: true, name: true, goal: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: flatCommentInclude
      },
      likes: true
    },
    orderBy: { createdAt: "desc" }
  });

  return posts.map((p) => ({ ...p, comments: buildCommentTree(p.comments as FlatComment[]) }));
}

export async function createPost(
  userId: string,
  input: { content: string; recipeLink?: string | null; type: "QUESTION" | "WIN" | "MEAL_IDEA" | "NEED_SUPPORT"; imageUrl?: string | null }
) {
  const post = await prisma.post.create({
    data: {
      userId,
      content: input.content,
      recipeLink: input.recipeLink ?? null,
      // Prisma client type may be resolved from a different workspace; keep runtime correct.
      type: input.type as any,
      imageUrl: (input.imageUrl ?? null) as any
    } as any,
    include: {
      user: { select: { id: true, name: true, goal: true } },
      comments: { orderBy: { createdAt: "asc" }, include: flatCommentInclude },
      likes: true
    }
  });

  try {
    getIo().to("feed").emit("feed:update", { kind: "post:created" });
  } catch {
    // io may be unavailable in some runtimes
  }

  return { ...post, comments: buildCommentTree(post.comments as FlatComment[]) };
}

export async function addComment(userId: string, input: { postId: string; content: string; parentId?: string | null }) {
  if (input.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: input.parentId }, select: { postId: true } });
    if (!parent || parent.postId !== input.postId) throw new HttpError(400, "Invalid parent comment");
  }

  const comment = await prisma.comment.create({
    data: { userId, postId: input.postId, content: input.content, parentId: input.parentId ?? null },
    include: { user: { select: { name: true } }, likes: true }
  });
  try {
    getIo().to(`post:${input.postId}`).to("feed").emit("post:update", {
      postId: input.postId,
      kind: input.parentId ? "reply:created" : "comment:created"
    });
  } catch {}

  const post = await prisma.post.findUnique({ where: { id: input.postId }, select: { userId: true } });
  if (post && post.userId !== userId) {
    await createNotification({
      userId: post.userId,
      type: "COMMUNITY",
      title: input.parentId ? "New reply on your comment" : "New comment on your post",
      body: `${comment.user.name ?? "Someone"} ${input.parentId ? "replied to your comment" : "commented on your post"}: "${input.content.slice(0, 80)}"`,
      link: "/dashboard/community",
    });
  }

  return comment;
}

export async function toggleCommentLike(userId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { postId: true } });
  if (!comment) throw new HttpError(404, "Comment not found");

  const existing = await prisma.commentLike.findUnique({ where: { userId_commentId: { userId, commentId } } });
  if (existing) {
    await prisma.commentLike.delete({ where: { userId_commentId: { userId, commentId } } });
    try {
      getIo().to(`post:${comment.postId}`).to("feed").emit("post:update", { postId: comment.postId, kind: "comment-like:changed" });
    } catch {}
    return { liked: false };
  }
  await prisma.commentLike.create({ data: { userId, commentId } });
  try {
    getIo().to(`post:${comment.postId}`).to("feed").emit("post:update", { postId: comment.postId, kind: "comment-like:changed" });
  } catch {}
  return { liked: true };
}

export async function toggleLike(userId: string, postId: string) {
  const existing = await prisma.postLike.findUnique({ where: { userId_postId: { userId, postId } } });
  if (existing) {
    await prisma.postLike.delete({ where: { userId_postId: { userId, postId } } });
    try {
      getIo().to(`post:${postId}`).to("feed").emit("post:update", { postId, kind: "like:changed" });
    } catch {}
    return { liked: false };
  }
  await prisma.postLike.create({ data: { userId, postId } });
  try {
    getIo().to(`post:${postId}`).to("feed").emit("post:update", { postId, kind: "like:changed" });
  } catch {}

  const [post, liker] = await Promise.all([
    prisma.post.findUnique({ where: { id: postId }, select: { userId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  if (post && post.userId !== userId) {
    await createNotification({
      userId: post.userId,
      type: "COMMUNITY",
      title: "New like on your post",
      body: `${liker?.name ?? "Someone"} liked your post.`,
      link: "/dashboard/community",
    });
  }

  return { liked: true };
}

export async function toggleBookmark(userId: string, postId: string) {
  const existing = await prisma.postBookmark.findUnique({ where: { userId_postId: { userId, postId } } });
  if (existing) {
    await prisma.postBookmark.delete({ where: { userId_postId: { userId, postId } } });
    return { bookmarked: false };
  }
  await prisma.postBookmark.create({ data: { userId, postId } });
  return { bookmarked: true };
}

export async function listBookmarkedPosts(userId: string) {
  const posts = await prisma.post.findMany({
    where: { bookmarks: { some: { userId } } },
    include: {
      user: { select: { id: true, name: true, goal: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: flatCommentInclude
      },
      likes: true
    },
    orderBy: { createdAt: "desc" }
  });

  return posts.map((p) => ({ ...p, comments: buildCommentTree(p.comments as FlatComment[]) }));
}

export async function reportPost(input: { reporterId: string; postId: string; reason: string }) {
  const post = await prisma.post.findUnique({ where: { id: input.postId }, select: { id: true } });
  if (!post) throw new HttpError(404, "Post not found");
  const existing = await prisma.report.findFirst({ where: { reporterId: input.reporterId, postId: input.postId } });
  if (existing) throw new HttpError(409, "You already reported this post");
  return prisma.report.create({
    data: { reporterId: input.reporterId, postId: input.postId, reason: input.reason },
  });
}

export async function acceptAnswer(userId: string, input: { postId: string; commentId: string }) {
  const post = await prisma.post.findUnique({ where: { id: input.postId }, select: { id: true, userId: true } });
  if (!post || post.userId !== userId) {
    throw new HttpError(403, "Not allowed");
  }
  const comment = await prisma.comment.findUnique({ where: { id: input.commentId }, select: { id: true, postId: true } });
  if (!comment || comment.postId !== input.postId) {
    throw new HttpError(400, "Invalid comment");
  }
  const updated = await prisma.post.update({ where: { id: input.postId }, data: { acceptedCommentId: input.commentId as any } as any });
  try {
    getIo().to(`post:${input.postId}`).to("feed").emit("post:update", { postId: input.postId, kind: "answer:accepted" });
  } catch {}
  return updated;
}

