import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { createNotification } from "../notifications/notifications.service.js";
import { assignUserGymTrainerForAdmin } from "../admin/admin.service.js";

export async function createTrainerChangeRequest(
  userId: string,
  input: { reason: string; description?: string | null; preferredRequirements?: string | null }
) {
  const existingPending = await prisma.trainerChangeRequest.findFirst({
    where: { userId, status: "PENDING" }
  });
  if (existingPending) throw new HttpError(409, "You already have a pending trainer-change request");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { gymTrainerId: true } });

  return prisma.trainerChangeRequest.create({
    data: {
      userId,
      reason: input.reason,
      description: input.description ?? null,
      preferredRequirements: input.preferredRequirements ?? null,
      previousTrainerId: user?.gymTrainerId ?? null
    }
  });
}

export async function getMyTrainerChangeRequest(userId: string) {
  return prisma.trainerChangeRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}

export async function listTrainerChangeRequestsForAdmin(opts: { page?: number; limit?: number; status?: string }) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;
  const where = opts.status ? { status: opts.status as any } : {};

  const [total, items] = await Promise.all([
    prisma.trainerChangeRequest.count({ where }),
    prisma.trainerChangeRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, gymTrainerId: true } } }
    })
  ]);

  return { total, page, limit, pages: Math.ceil(total / limit), items };
}

export async function reviewTrainerChangeRequest(
  requestId: string,
  input: { status: "APPROVED" | "REJECTED" | "COMPLETED"; adminComment?: string | null; newTrainerId?: string | null }
) {
  const request = await prisma.trainerChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, "Request not found");
  if (request.status !== "PENDING" && request.status !== "APPROVED") {
    throw new HttpError(400, "This request has already been resolved");
  }

  // Completing performs the actual swap through the same path an admin's
  // direct trainer-assignment uses — a change request is never a second way
  // to bypass that logic, only a formal ask that routes through it.
  if (input.status === "COMPLETED") {
    if (!input.newTrainerId) throw new HttpError(400, "newTrainerId is required to complete this request");
    await assignUserGymTrainerForAdmin({ userId: request.userId, trainerId: input.newTrainerId });
  }

  const updated = await prisma.trainerChangeRequest.update({
    where: { id: requestId },
    data: {
      status: input.status,
      adminComment: input.adminComment ?? undefined,
      newTrainerId: input.status === "COMPLETED" ? input.newTrainerId : undefined,
      reviewedAt: new Date()
    }
  });

  const statusText = input.status === "APPROVED" ? "approved" : input.status === "REJECTED" ? "declined" : "completed";
  await createNotification({
    userId: request.userId,
    type: "GYM",
    title: `Trainer change request ${statusText}`,
    body: input.adminComment
      ? `Your trainer change request was ${statusText}. Note: ${input.adminComment}`
      : `Your trainer change request was ${statusText}.`,
    link: "/dashboard/settings?tab=preferences"
  });

  return updated;
}
