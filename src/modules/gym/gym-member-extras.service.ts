import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { notifyTrainerMissedWorkout } from "./plan-request-notify.js";

export async function listGymProgressPhotos(userId: string) {
  return prisma.gymProgressPhoto.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 80
  });
}

export async function createGymProgressPhoto(
  userId: string,
  input: { imageUrl: string; caption?: string | null }
) {
  const url = input.imageUrl?.trim();
  if (!url || url.length < 10) {
    throw new HttpError(400, "imageUrl is required");
  }
  return prisma.gymProgressPhoto.create({
    data: {
      userId,
      imageUrl: url,
      caption: input.caption?.trim() || null
    }
  });
}

export async function createMissedWorkoutReport(userId: string, reasonRaw: string) {
  const reason = reasonRaw?.trim() ?? "";
  if (reason.length < 8) {
    throw new HttpError(400, "Please explain in at least 8 characters why you cannot work out");
  }
  if (reason.length > 2000) {
    throw new HttpError(400, "Reason is too long");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gymTrainerId: true, role: true }
  });
  if (!user?.gymTrainerId) {
    throw new HttpError(400, "Assign a gym trainer in onboarding or profile settings so we can notify them");
  }
  if (user.role === "GYM_TRAINER") {
    throw new HttpError(400, "Trainer accounts use the trainer dashboard");
  }

  const created = await prisma.missedWorkoutReport.create({
    data: {
      userId,
      gymTrainerId: user.gymTrainerId,
      reason
    }
  });

  const dm = await notifyTrainerMissedWorkout(userId, created.id, user.gymTrainerId, reason);
  return { ...created, dmNotify: dm };
}
