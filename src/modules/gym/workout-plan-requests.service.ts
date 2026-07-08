import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { notifyTrainerPlanRequest } from "./plan-request-notify.js";
import { createNotification } from "../notifications/notifications.service.js";

function parseSessionsJson(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createPlanChangeRequest(
  userId: string,
  input: { memberNote?: string | null; proposedSessionsJson: string }
) {
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

  if (created.gymTrainer?.id) {
    const trainerProfile = await prisma.gymTrainer.findUnique({ where: { id: created.gymTrainer.id }, select: { linkedUserId: true } });
    if (trainerProfile?.linkedUserId) {
      const member = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      await createNotification({
        userId: trainerProfile.linkedUserId,
        type: "GYM",
        title: "Plan change requested",
        body: `${member?.name ?? "A member"} requested a change to their workout plan.`,
        link: "/dashboard/gym-trainer",
      });
    }
  }

  return { ...created, dmNotify };
}

export async function getLatestPlanRequestForMember(userId: string) {
  return prisma.workoutPlanChangeRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      gymTrainer: { select: { id: true, name: true, imageUrl: true, title: true } }
    }
  });
}

export async function listPendingForTrainer(trainerUserId: string) {
  const profile = await prisma.gymTrainer.findFirst({
    where: { linkedUserId: trainerUserId }
  });
  if (!profile) return [];

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

export async function listMyMembers(trainerUserId: string) {
  const profile = await prisma.gymTrainer.findFirst({
    where: { linkedUserId: trainerUserId }
  });
  if (!profile) return [];

  return prisma.user.findMany({
    where: { gymTrainerId: profile.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      goal: true,
      heightCm: true,
      weightKg: true,
      age: true,
      gender: true,
      activityLevel: true,
      dietaryStyle: true,
      approvedGymPlanJson: true,
      onboardingCompletedAt: true
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getMemberDetailForTrainer(trainerUserId: string, memberId: string) {
  const profile = await prisma.gymTrainer.findFirst({
    where: { linkedUserId: trainerUserId }
  });
  if (!profile) {
    throw new HttpError(403, "No trainer profile is linked to this account");
  }

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      goal: true,
      heightCm: true,
      weightKg: true,
      age: true,
      gender: true,
      activityLevel: true,
      dietaryStyle: true,
      dietaryPreferences: true,
      bodyFatPercent: true,
      approvedGymPlanJson: true,
      onboardingCompletedAt: true,
      gymTrainerId: true
    }
  });
  if (!member || member.gymTrainerId !== profile.id) {
    throw new HttpError(403, "This member is not assigned to you");
  }

  const workoutHistory = await prisma.workoutLog.findMany({
    where: { userId: memberId },
    orderBy: { performedAt: "desc" },
    take: 40
  });

  const { gymTrainerId: _gymTrainerId, ...memberFields } = member;
  return { ...memberFields, workoutHistory };
}

export async function assignInitialPlan(
  trainerUserId: string,
  memberId: string,
  proposedSessionsJson: string
) {
  const profile = await prisma.gymTrainer.findFirst({
    where: { linkedUserId: trainerUserId }
  });
  if (!profile) {
    throw new HttpError(403, "No trainer profile is linked to this account");
  }

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { gymTrainerId: true }
  });
  if (!member || member.gymTrainerId !== profile.id) {
    throw new HttpError(403, "This member is not assigned to you");
  }

  const sessions = parseSessionsJson(proposedSessionsJson);
  if (!sessions || sessions.length === 0) {
    throw new HttpError(400, "proposedSessionsJson must be a non-empty JSON array of gym sessions");
  }

  const updated = await prisma.user.update({
    where: { id: memberId },
    data: { approvedGymPlanJson: proposedSessionsJson },
    select: { id: true, name: true, approvedGymPlanJson: true }
  });

  await createNotification({
    userId: memberId,
    type: "GYM",
    title: "Your workout plan is ready",
    body: "Your trainer has created your personalized workout plan. Check it out!",
    link: "/dashboard/gym",
  });

  return updated;
}

export async function reviewPlanRequest(
  trainerUserId: string,
  requestId: string,
  action: "approve" | "reject",
  trainerComment?: string | null,
  editedSessionsJson?: string | null
) {
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
  if (!request) throw new HttpError(404, "Request not found");
  if (request.gymTrainerId !== profile.id) {
    throw new HttpError(403, "This request belongs to another trainer");
  }
  if (request.status !== "PENDING") {
    throw new HttpError(400, "Request is already reviewed");
  }

  const now = new Date();
  const comment = trainerComment?.trim() || null;

  if (action === "reject") {
    const rejected = await prisma.workoutPlanChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        trainerComment: comment,
        reviewedAt: now,
        reviewedByUserId: trainerUserId
      }
    });
    await createNotification({
      userId: request.userId,
      type: "GYM",
      title: "Plan request declined",
      body: comment ? `Your trainer declined your workout plan request: "${comment}"` : "Your trainer declined your workout plan request.",
      link: "/dashboard/gym",
    });
    return rejected;
  }

  let finalSessionsJson = request.proposedSessionsJson;
  let wasEdited = false;
  if (editedSessionsJson != null && editedSessionsJson.trim()) {
    const parsed = parseSessionsJson(editedSessionsJson);
    if (!parsed || parsed.length === 0) {
      throw new HttpError(400, "editedSessionsJson must be a non-empty JSON array of gym sessions");
    }
    finalSessionsJson = editedSessionsJson;
    wasEdited = editedSessionsJson !== request.proposedSessionsJson;
  }

  await prisma.$transaction([
    prisma.workoutPlanChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        trainerComment: comment,
        reviewedAt: now,
        reviewedByUserId: trainerUserId,
        ...(wasEdited ? { proposedSessionsJson: finalSessionsJson } : {})
      }
    }),
    prisma.user.update({
      where: { id: request.userId },
      data: { approvedGymPlanJson: finalSessionsJson }
    })
  ]);

  await createNotification({
    userId: request.userId,
    type: "GYM",
    title: wasEdited ? "Workout plan approved (with changes)" : "Workout plan approved",
    body: wasEdited
      ? "Your trainer approved your request, with some adjustments. Check out your updated plan!"
      : "Your trainer approved your workout plan. Check it out!",
    link: "/dashboard/gym",
  });

  return prisma.workoutPlanChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      gymTrainer: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } }
    }
  });
}
