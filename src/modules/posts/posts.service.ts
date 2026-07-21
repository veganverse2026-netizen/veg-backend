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

export async function getFeed(opts: { limit?: number; cursor?: string; q?: string; type?: string } = {}) {
  const limit = Math.max(1, Math.min(MAX_FEED_POSTS, opts.limit ?? 10));
  const where: any = {};
  if (opts.q) {
    where.content = { contains: opts.q, mode: "insensitive" };
  }
  if (opts.type) {
    where.type = opts.type;
  }

  const posts = await prisma.post.findMany({
    where,
    // fetch one extra row so we can tell whether another page exists without a second count query
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      user: { select: { id: true, name: true, goal: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: flatCommentInclude
      },
      likes: true
    },
    // secondary id order keeps pagination stable if two posts share a createdAt tick
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });

  const hasMore = posts.length > limit;
  const page = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return {
    posts: page.map((p) => ({ ...p, comments: buildCommentTree(p.comments as FlatComment[]) })),
    nextCursor
  };
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

export async function deletePost(userId: string, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
  // 404 (not 403) for someone else's post: don't leak that the id exists.
  if (!post || post.userId !== userId) throw new HttpError(404, "Post not found");

  // Comments, likes, and bookmarks cascade via the schema relations.
  await prisma.post.delete({ where: { id: postId } });
  try {
    getIo().to("feed").emit("feed:update", { kind: "post:deleted" });
  } catch {}
  return { deleted: true };
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

export async function listDrafts(userId: string) {
  return prisma.postDraft.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" }
  });
}

export async function saveDraft(
  userId: string,
  input: { content: string; type: "QUESTION" | "WIN" | "MEAL_IDEA" | "NEED_SUPPORT"; imageUrl?: string | null }
) {
  return prisma.postDraft.create({
    data: {
      userId,
      content: input.content,
      type: input.type as any,
      imageUrl: input.imageUrl ?? null
    }
  });
}

export async function deleteDraft(userId: string, draftId: string) {
  const draft = await prisma.postDraft.findUnique({ where: { id: draftId }, select: { userId: true } });
  if (!draft || draft.userId !== userId) throw new HttpError(404, "Draft not found");
  await prisma.postDraft.delete({ where: { id: draftId } });
  return { deleted: true };
}

export async function getMyCommunityStats(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // "Received" counts exclude the user's own likes/comments on their own content.
  const notMe = { not: userId };

  const [
    postCount,
    postsThisWeek,
    postLikesReceived,
    postLikesThisWeek,
    commentLikesReceived,
    commentLikesThisWeek,
    commentsReceived,
    commentsThisWeek,
    user
  ] = await Promise.all([
    prisma.post.count({ where: { userId } }),
    prisma.post.count({ where: { userId, createdAt: { gte: weekAgo } } }),
    prisma.postLike.count({ where: { post: { userId }, userId: notMe } }),
    prisma.postLike.count({ where: { post: { userId }, userId: notMe, createdAt: { gte: weekAgo } } }),
    prisma.commentLike.count({ where: { comment: { userId }, userId: notMe } }),
    prisma.commentLike.count({ where: { comment: { userId }, userId: notMe, createdAt: { gte: weekAgo } } }),
    prisma.comment.count({ where: { post: { userId }, userId: notMe } }),
    prisma.comment.count({ where: { post: { userId }, userId: notMe, createdAt: { gte: weekAgo } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { streakCount: true } })
  ]);

  return {
    posts: postCount,
    postsThisWeek,
    likesReceived: postLikesReceived + commentLikesReceived,
    likesThisWeek: postLikesThisWeek + commentLikesThisWeek,
    commentsReceived,
    commentsThisWeek,
    dayStreak: user?.streakCount ?? 0
  };
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

