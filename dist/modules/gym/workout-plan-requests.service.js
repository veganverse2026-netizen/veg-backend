import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { notifyTrainerPlanRequest } from "./plan-request-notify.js";
function parseSessionsJson(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
export async function createPlanChangeRequest(userId, input) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { gymTrainerId: true, role: true }
    });
    if (!user?.gymTrainerId) {
        throw new HttpError(400, "Assign a gym trainer during onboarding or in profile settings first");
    }
    if (user.role === "GYM_TRAINER") {
        throw new HttpError(400, "Trainer accounts cannot submit member plan requests");
    }
    const pending = await prisma.workoutPlanChangeRequest.findFirst({
        where: { userId, status: "PENDING" }
    });
    if (pending) {
        throw new HttpError(400, "You already have a modification waiting for your trainer. Wait for approval or cancel flow.");
    }
    const sessions = parseSessionsJson(input.proposedSessionsJson);
    if (!sessions || sessions.length === 0) {
        throw new HttpError(400, "proposedSessionsJson must be a non-empty JSON array of gym sessions");
    }
    const created = await prisma.workoutPlanChangeRequest.create({
        data: {
            userId,
            gymTrainerId: user.gymTrainerId,
            memberNote: input.memberNote?.trim() || null,
            proposedSessionsJson: input.proposedSessionsJson
        },
        include: {
            gymTrainer: { select: { id: true, name: true, imageUrl: true, title: true } }
        }
    });
    const dmNotify = await notifyTrainerPlanRequest(userId, created.id, created.gymTrainerId);
    return { ...created, dmNotify };
}
export async function getLatestPlanRequestForMember(userId) {
    return prisma.workoutPlanChangeRequest.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
            gymTrainer: { select: { id: true, name: true, imageUrl: true, title: true } }
        }
    });
}
export async function listPendingForTrainer(trainerUserId) {
    const profile = await prisma.gymTrainer.findFirst({
        where: { linkedUserId: trainerUserId }
    });
    if (!profile)
        return [];
    return prisma.workoutPlanChangeRequest.findMany({
        where: { gymTrainerId: profile.id, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: {
            user: {
                select: { id: true, name: true, email: true, image: true, goal: true }
            },
            gymTrainer: { select: { id: true, name: true } }
        }
    });
}
export async function reviewPlanRequest(trainerUserId, requestId, action, trainerComment) {
    const profile = await prisma.gymTrainer.findFirst({
        where: { linkedUserId: trainerUserId }
    });
    if (!profile) {
        throw new HttpError(403, "No trainer profile is linked to this account");
    }
    const request = await prisma.workoutPlanChangeRequest.findUnique({
        where: { id: requestId },
        include: { user: true }
    });
    if (!request)
        throw new HttpError(404, "Request not found");
    if (request.gymTrainerId !== profile.id) {
        throw new HttpError(403, "This request belongs to another trainer");
    }
    if (request.status !== "PENDING") {
        throw new HttpError(400, "Request is already reviewed");
    }
    const now = new Date();
    const comment = trainerComment?.trim() || null;
    if (action === "reject") {
        return prisma.workoutPlanChangeRequest.update({
            where: { id: requestId },
            data: {
                status: "REJECTED",
                trainerComment: comment,
                reviewedAt: now,
                reviewedByUserId: trainerUserId
            }
        });
    }
    await prisma.$transaction([
        prisma.workoutPlanChangeRequest.update({
            where: { id: requestId },
            data: {
                status: "APPROVED",
                trainerComment: comment,
                reviewedAt: now,
                reviewedByUserId: trainerUserId
            }
        }),
        prisma.user.update({
            where: { id: request.userId },
            data: { approvedGymPlanJson: request.proposedSessionsJson }
        })
    ]);
    return prisma.workoutPlanChangeRequest.findUnique({
        where: { id: requestId },
        include: {
            gymTrainer: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } }
        }
    });
}
