import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { getIo } from "../../infrastructure/realtime/socket.js";
const prismaAny = prisma;
function orderedPair(a, b) {
    return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}
export async function listInbox(userId) {
    const conversations = await prismaAny.conversation.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        orderBy: { updatedAt: "desc" },
        include: {
            userA: { select: { id: true, name: true, image: true } },
            userB: { select: { id: true, name: true, image: true } },
            messages: { orderBy: { createdAt: "desc" }, take: 1 }
        }
    });
    return conversations.map((c) => {
        const other = c.userAId === userId ? c.userB : c.userA;
        return {
            id: c.id,
            otherUser: other,
            updatedAt: c.updatedAt,
            lastMessage: c.messages[0] ?? null
        };
    });
}
export async function getOrCreateConversation(userId, targetUserId) {
    if (userId === targetUserId)
        throw new HttpError(400, "You cannot message yourself");
    const pair = orderedPair(userId, targetUserId);
    const existing = await prismaAny.conversation.findUnique({ where: { userAId_userBId: pair } });
    if (existing)
        return existing;
    return await prismaAny.conversation.create({ data: pair });
}
export async function listMessages(userId, conversationId, limit = 50) {
    const convo = await prismaAny.conversation.findUnique({ where: { id: conversationId } });
    if (!convo || (convo.userAId !== userId && convo.userBId !== userId))
        throw new HttpError(404, "Conversation not found");
    return await prismaAny.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: Math.max(1, Math.min(200, limit))
    });
}
export async function sendMessage(userId, conversationId, content) {
    const convo = await prismaAny.conversation.findUnique({ where: { id: conversationId } });
    if (!convo || (convo.userAId !== userId && convo.userBId !== userId))
        throw new HttpError(404, "Conversation not found");
    const msg = await prismaAny.message.create({
        data: { conversationId, senderId: userId, content }
    });
    // bump updatedAt
    await prismaAny.conversation.update({ where: { id: conversationId }, data: {} });
    try {
        getIo().to(`dm:${conversationId}`).emit("dm:message", { conversationId, message: msg });
        getIo().to("feed").emit("dm:inbox:update", { conversationId });
    }
    catch {
        // ignore if io not initialized
    }
    return msg;
}
export async function markConversationRead(userId, conversationId) {
    const convo = await prismaAny.conversation.findUnique({ where: { id: conversationId } });
    if (!convo || (convo.userAId !== userId && convo.userBId !== userId))
        throw new HttpError(404, "Conversation not found");
    const now = new Date();
    const read = await prismaAny.conversationRead.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        update: { lastReadAt: now },
        create: { conversationId, userId, lastReadAt: now }
    });
    try {
        getIo().to(`dm:${conversationId}`).emit("dm:read", { conversationId, userId, lastReadAt: read.lastReadAt });
    }
    catch { }
    return read;
}
export async function deleteConversation(userId, conversationId) {
    const convo = await prismaAny.conversation.findUnique({ where: { id: conversationId } });
    if (!convo || (convo.userAId !== userId && convo.userBId !== userId))
        throw new HttpError(404, "Conversation not found");
    await prismaAny.conversation.delete({ where: { id: conversationId } });
    try {
        getIo().to(`dm:${conversationId}`).emit("dm:conversation:deleted", { conversationId });
        getIo().to("feed").emit("dm:inbox:update", { conversationId });
    }
    catch { }
    return { ok: true };
}
export async function deleteMessage(userId, messageId) {
    const msg = await prismaAny.message.findUnique({ where: { id: messageId } });
    if (!msg)
        throw new HttpError(404, "Message not found");
    const convo = await prismaAny.conversation.findUnique({ where: { id: msg.conversationId } });
    if (!convo || (convo.userAId !== userId && convo.userBId !== userId))
        throw new HttpError(404, "Conversation not found");
    if (msg.senderId !== userId)
        throw new HttpError(403, "You can only delete your own messages");
    await prismaAny.message.delete({ where: { id: messageId } });
    try {
        getIo().to(`dm:${msg.conversationId}`).emit("dm:message:deleted", { conversationId: msg.conversationId, messageId });
        getIo().to("feed").emit("dm:inbox:update", { conversationId: msg.conversationId });
    }
    catch { }
    return { ok: true };
}
