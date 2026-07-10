import { prisma } from "../../infrastructure/db/prisma.js";
import { getOrCreateConversation, sendMessage } from "../dm/dm.service.js";
/**
 * Opens/writes the member ↔ trainer DM thread when a gym plan change is submitted.
 * Requires GymTrainer.linkedUserId to point at the trainer's User account.
 */
export async function notifyTrainerPlanRequest(memberUserId, requestId, gymTrainerCatalogId) {
    const [member, trainerRow] = await Promise.all([
        prisma.user.findUnique({
            where: { id: memberUserId },
            select: { name: true, email: true }
        }),
        prisma.gymTrainer.findUnique({
            where: { id: gymTrainerCatalogId },
            select: { linkedUserId: true, name: true }
        })
    ]);
    if (!trainerRow?.linkedUserId) {
        return { notified: false, reason: "trainer_not_linked" };
    }
    const convo = await getOrCreateConversation(memberUserId, trainerRow.linkedUserId);
    const label = member?.name?.trim() || member?.email?.trim() || "A member";
    const short = requestId.slice(0, 8);
    const content = `📋 Gym week submitted for approval

${label} sent you their proposed gym week (ref · ${short}). Review it in your Trainer Portal on the admin panel (Gym Trainer → pending requests), or reply here.`;
    await sendMessage(memberUserId, convo.id, content);
    return { notified: true, conversationId: convo.id };
}
/**
 * Notifies the assigned trainer (DM) when a member cannot train and sends a reason.
 */
export async function notifyTrainerMissedWorkout(memberUserId, reportId, gymTrainerCatalogId, reason) {
    const [member, trainerRow] = await Promise.all([
        prisma.user.findUnique({
            where: { id: memberUserId },
            select: { name: true, email: true }
        }),
        prisma.gymTrainer.findUnique({
            where: { id: gymTrainerCatalogId },
            select: { linkedUserId: true, name: true }
        })
    ]);
    if (!trainerRow?.linkedUserId) {
        return { notified: false, reason: "trainer_not_linked" };
    }
    const convo = await getOrCreateConversation(memberUserId, trainerRow.linkedUserId);
    const label = member?.name?.trim() || member?.email?.trim() || "A member";
    const short = reportId.slice(0, 8);
    const content = `⚠️ Cannot work out — member update

${label} logged that they will miss training today.

Reason:
${reason}

(Ref · ${short})`;
    await sendMessage(memberUserId, convo.id, content);
    return { notified: true, conversationId: convo.id };
}
