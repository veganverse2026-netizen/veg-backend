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

const BUNDLE_INCLUDE = {
  items: { include: { product: true } },
  trainer: { select: { name: true, imageUrl: true } }
} as const;

/** Member-facing: bundles their own assigned trainer has recommended to them. */
export async function listMyRecommendedBundles(memberUserId: string) {
  return prisma.trainerProductBundle.findMany({
    where: { memberId: memberUserId },
    include: BUNDLE_INCLUDE,
    orderBy: { createdAt: "desc" }
  });
}

async function requireTrainerProfileFor(trainerUserId: string) {
  const profile = await prisma.gymTrainer.findFirst({ where: { linkedUserId: trainerUserId } });
  if (!profile) throw new HttpError(403, "No trainer profile is linked to this account");
  return profile;
}

async function requireOwnMember(trainerProfileId: string, memberId: string) {
  const member = await prisma.user.findUnique({ where: { id: memberId }, select: { gymTrainerId: true } });
  if (!member || member.gymTrainerId !== trainerProfileId) {
    throw new HttpError(403, "This member is not assigned to you");
  }
}

/** Trainer-facing: bundles this trainer has recommended to one of their own members. */
export async function listBundlesForMemberAsTrainer(trainerUserId: string, memberId: string) {
  const profile = await requireTrainerProfileFor(trainerUserId);
  await requireOwnMember(profile.id, memberId);

  return prisma.trainerProductBundle.findMany({
    where: { trainerId: profile.id, memberId },
    include: BUNDLE_INCLUDE,
    orderBy: { createdAt: "desc" }
  });
}

export async function createTrainerBundle(
  trainerUserId: string,
  memberId: string,
  input: { title: string; note: string; productIds: string[] }
) {
  const profile = await requireTrainerProfileFor(trainerUserId);
  await requireOwnMember(profile.id, memberId);

  const title = input.title?.trim() ?? "";
  const note = input.note?.trim() ?? "";
  const productIds = [...new Set(input.productIds ?? [])];

  if (title.length < 3) throw new HttpError(400, "Give the bundle a short title (3+ characters)");
  if (note.length < 10) throw new HttpError(400, "Explain why you're recommending this bundle (10+ characters)");
  if (productIds.length === 0) throw new HttpError(400, "Add at least one product to the bundle");
  if (productIds.length > 10) throw new HttpError(400, "A bundle can have at most 10 products");

  const realProducts = await prisma.product.count({ where: { id: { in: productIds }, status: "ACTIVE" } });
  if (realProducts !== productIds.length) {
    throw new HttpError(400, "One or more products aren't available");
  }

  return prisma.trainerProductBundle.create({
    data: {
      trainerId: profile.id,
      memberId,
      title,
      note,
      items: { create: productIds.map((productId) => ({ productId })) }
    },
    include: BUNDLE_INCLUDE
  });
}

export async function deleteTrainerBundle(trainerUserId: string, bundleId: string) {
  const profile = await requireTrainerProfileFor(trainerUserId);
  const bundle = await prisma.trainerProductBundle.findUnique({ where: { id: bundleId }, select: { trainerId: true } });
  if (!bundle || bundle.trainerId !== profile.id) {
    throw new HttpError(404, "Bundle not found");
  }
  await prisma.trainerProductBundle.delete({ where: { id: bundleId } });
  return { success: true };
}
