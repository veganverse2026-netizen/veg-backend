import { prisma } from "../../infrastructure/db/prisma.js";
import { getIo } from "../../infrastructure/realtime/socket.js";
import { HttpError } from "../../shared/errors/http-error.js";
export async function getFeed() {
    return await prisma.post.findMany({
        include: {
            user: { select: { id: true, name: true, goal: true } },
            comments: {
                orderBy: { createdAt: "asc" },
                include: { user: { select: { name: true } } },
            },
            likes: true
        },
        orderBy: { createdAt: "desc" }
    });
}
export async function createPost(userId, input) {
    await prisma.post.create({
        data: {
            userId,
            content: input.content,
            recipeLink: input.recipeLink ?? null,
            // Prisma client type may be resolved from a different workspace; keep runtime correct.
            type: input.type,
            imageUrl: (input.imageUrl ?? null)
        }
    });
    try {
        getIo().to("feed").emit("feed:update", { kind: "post:created" });
    }
    catch {
        // io may be unavailable in some runtimes
    }
}
export async function addComment(userId, input) {
    await prisma.comment.create({ data: { userId, postId: input.postId, content: input.content } });
    try {
        getIo().to(`post:${input.postId}`).to("feed").emit("post:update", { postId: input.postId, kind: "comment:created" });
    }
    catch { }
}
export async function toggleLike(userId, postId) {
    const existing = await prisma.postLike.findUnique({ where: { userId_postId: { userId, postId } } });
    if (existing) {
        await prisma.postLike.delete({ where: { userId_postId: { userId, postId } } });
        try {
            getIo().to(`post:${postId}`).to("feed").emit("post:update", { postId, kind: "like:changed" });
        }
        catch { }
        return { liked: false };
    }
    await prisma.postLike.create({ data: { userId, postId } });
    try {
        getIo().to(`post:${postId}`).to("feed").emit("post:update", { postId, kind: "like:changed" });
    }
    catch { }
    return { liked: true };
}
export async function reportPost(input) {
    const post = await prisma.post.findUnique({ where: { id: input.postId }, select: { id: true } });
    if (!post)
        throw new HttpError(404, "Post not found");
    const existing = await prisma.report.findFirst({ where: { reporterId: input.reporterId, postId: input.postId } });
    if (existing)
        throw new HttpError(409, "You already reported this post");
    return prisma.report.create({
        data: { reporterId: input.reporterId, postId: input.postId, reason: input.reason },
    });
}
export async function acceptAnswer(userId, input) {
    const post = await prisma.post.findUnique({ where: { id: input.postId }, select: { id: true, userId: true } });
    if (!post || post.userId !== userId) {
        throw new Error("Not allowed");
    }
    const comment = await prisma.comment.findUnique({ where: { id: input.commentId }, select: { id: true, postId: true } });
    if (!comment || comment.postId !== input.postId) {
        throw new Error("Invalid comment");
    }
    const updated = await prisma.post.update({ where: { id: input.postId }, data: { acceptedCommentId: input.commentId } });
    try {
        getIo().to(`post:${input.postId}`).to("feed").emit("post:update", { postId: input.postId, kind: "answer:accepted" });
    }
    catch { }
    return updated;
}
