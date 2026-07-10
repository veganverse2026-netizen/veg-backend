import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { getIo } from "../../infrastructure/realtime/socket.js";
import { createNotification } from "../notifications/notifications.service.js";
const prismaAny = prisma;
function orderedPair(a, b) {
    return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}
// Scoped to relationships that have a real chat surface: trainer<->their
// assigned member, and admin<->trainer (support channel in the admin panel).
// Other DMs don't notify — bridges the chat into the Notification center
// only where the recipient has somewhere to read and reply.
async function notifyDmRecipient(senderId, recipientId, content) {
    const [sender, recipient] = await Promise.all([
        prisma.user.findUnique({ where: { id: senderId }, select: { name: true, role: true, gymTrainerId: true } }),
        prisma.user.findUnique({ where: { id: recipientId }, select: { role: true, gymTrainerId: true } })
    ]);
    if (!sender || !recipient)
        return;
    const preview = `${sender.name ?? "Someone"}: "${content.slice(0, 80)}"`;
    // Admin <-> trainer support channel (both sides live in the admin panel)
    if (sender.role === "ADMIN" && recipient.role === "GYM_TRAINER") {
        await createNotification({
            userId: recipientId, type: "GYM", title: "New message from the VeganFit team",
            body: preview, link: "/dashboard/gym-trainer/messages",
        });
        return;
    }
    if (sender.role === "GYM_TRAINER" && recipient.role === "ADMIN") {
        await createNotification({
            userId: recipientId, type: "GYM", title: "New message from a trainer",
            body: preview, link: "/dashboard/messages",
        });
        return;
    }
    let isTrainerMemberPair = false;
    if (sender.role === "GYM_TRAINER" && recipient.gymTrainerId) {
        const trainerProfile = await prisma.gymTrainer.findUnique({ where: { id: recipient.gymTrainerId }, select: { linkedUserId: true } });
        isTrainerMemberPair = trainerProfile?.linkedUserId === senderId;
    }
    else if (recipient.role === "GYM_TRAINER" && sender.gymTrainerId) {
        const trainerProfile = await prisma.gymTrainer.findUnique({ where: { id: sender.gymTrainerId }, select: { linkedUserId: true } });
        isTrainerMemberPair = trainerProfile?.linkedUserId === recipientId;
    }
    if (!isTrainerMemberPair)
        return;
    await createNotification({
        userId: recipientId,
        type: "GYM",
        title: recipient.role === "GYM_TRAINER" ? "New message from your member" : "New message from your trainer",
        body: preview,
        link: recipient.role === "GYM_TRAINER" ? "/dashboard/gym-trainer" : "/dashboard/gym",
    });
}
// Who a trainer should message for help — the primary admin account. Lets
// the trainer portal open a support conversation without knowing admin ids.
export async function getSupportContact() {
    const admin = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true }
    });
    if (!admin)
        throw new HttpError(404, "No admin account exists");
    return admin;
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
    const recipientId = convo.userAId === userId ? convo.userBId : convo.userAId;
    await notifyDmRecipient(userId, recipientId, content);
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
