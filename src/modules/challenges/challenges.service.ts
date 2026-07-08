import { prisma } from "../../infrastructure/db/prisma.js";
import { getIo } from "../../infrastructure/realtime/socket.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { createNotification } from "../notifications/notifications.service.js";

const MAX_ACTIVE_CHALLENGES = 20;

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function computeProgress(challengeId: string, userId: string, durationDays: number) {
  const checkIns = await prisma.challengeCheckIn.findMany({
    where: { challengeId, userId },
    select: { date: true }
  });

  const completedDays = checkIns.length;
  const progressPercent = Math.min(100, Math.round((completedDays / durationDays) * 100));

  const dateKeys = new Set(checkIns.map((c) => dateKey(c.date)));
  const checkedInToday = dateKeys.has(dateKey(startOfDay(new Date())));

  let currentStreak = 0;
  const cursor = startOfDay(new Date());
  while (dateKeys.has(dateKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { completedDays, progressPercent, currentStreak, checkedInToday };
}

function emitFeedUpdate(kind: string) {
  try {
    getIo().to("feed").emit("feed:update", { kind });
  } catch {
    // io may be unavailable in some runtimes
  }
}

export async function listActiveChallenges(userId?: string) {
  const challenges = await prisma.challenge.findMany({
    where: { endDate: { gt: new Date() } },
    take: MAX_ACTIVE_CHALLENGES,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      participants: userId ? { where: { userId }, select: { userId: true } } : false,
      _count: { select: { participants: true } }
    }
  });

  return challenges.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    difficulty: c.difficulty,
    coverImageUrl: c.coverImageUrl,
    rewardText: c.rewardText,
    durationDays: c.durationDays,
    startDate: c.startDate,
    endDate: c.endDate,
    createdBy: c.createdBy,
    participantCount: c._count.participants,
    joined: userId ? (c as any).participants.length > 0 : false
  }));
}

export async function getChallengeDetail(challengeId: string, userId?: string) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      createdBy: { select: { id: true, name: true } },
      participants: {
        orderBy: { joinedAt: "asc" },
        select: { userId: true, joinedAt: true, user: { select: { id: true, name: true, image: true } } }
      }
    }
  });
  if (!challenge) throw new HttpError(404, "Challenge not found");

  const joined = !!userId && challenge.participants.some((p) => p.userId === userId);
  const progress = joined ? await computeProgress(challenge.id, userId!, challenge.durationDays) : null;

  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    category: challenge.category,
    difficulty: challenge.difficulty,
    coverImageUrl: challenge.coverImageUrl,
    rules: challenge.rules,
    rewardText: challenge.rewardText,
    durationDays: challenge.durationDays,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    createdBy: challenge.createdBy,
    isCreator: userId === challenge.createdById,
    participantCount: challenge.participants.length,
    participants: challenge.participants.map((p) => p.user),
    joined,
    progress
  };
}

export async function createChallenge(
  userId: string,
  input: {
    title: string;
    description: string;
    durationDays: number;
    category: string;
    difficulty: string;
    coverImageUrl?: string;
    rules?: string;
    rewardText?: string;
  }
) {
  const endDate = new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000);

  const challenge = await prisma.challenge.create({
    data: {
      title: input.title,
      description: input.description,
      category: input.category as any,
      difficulty: input.difficulty as any,
      coverImageUrl: input.coverImageUrl,
      rules: input.rules,
      rewardText: input.rewardText,
      durationDays: input.durationDays,
      endDate,
      createdById: userId,
      // The creator automatically joins their own challenge.
      participants: { create: { userId } }
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      _count: { select: { participants: true } }
    }
  });

  emitFeedUpdate("challenge:created");

  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    category: challenge.category,
    difficulty: challenge.difficulty,
    coverImageUrl: challenge.coverImageUrl,
    rewardText: challenge.rewardText,
    durationDays: challenge.durationDays,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    createdBy: challenge.createdBy,
    participantCount: challenge._count.participants,
    joined: true
  };
}

export async function joinChallenge(userId: string, challengeId: string) {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId }, select: { endDate: true, createdById: true, title: true } });
  if (!challenge) throw new HttpError(404, "Challenge not found");
  if (challenge.endDate <= new Date()) throw new HttpError(400, "This challenge has already ended");

  await prisma.challengeParticipant.upsert({
    where: { challengeId_userId: { challengeId, userId } },
    create: { challengeId, userId },
    update: {}
  });

  emitFeedUpdate("challenge:joined");

  if (challenge.createdById && challenge.createdById !== userId) {
    const joiner = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await createNotification({
      userId: challenge.createdById,
      type: "COMMUNITY",
      title: "New challenge participant",
      body: `${joiner?.name ?? "Someone"} joined your challenge "${challenge.title}".`,
      link: `/dashboard/challenges/${challengeId}`,
    });
  }

  const participantCount = await prisma.challengeParticipant.count({ where: { challengeId } });
  return { joined: true, participantCount };
}

export async function leaveChallenge(userId: string, challengeId: string) {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId }, select: { id: true } });
  if (!challenge) throw new HttpError(404, "Challenge not found");

  await prisma.challengeParticipant.deleteMany({ where: { challengeId, userId } });

  emitFeedUpdate("challenge:left");

  const participantCount = await prisma.challengeParticipant.count({ where: { challengeId } });
  return { joined: false, participantCount };
}

export async function checkInChallenge(userId: string, challengeId: string) {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId }, select: { endDate: true, durationDays: true } });
  if (!challenge) throw new HttpError(404, "Challenge not found");
  if (challenge.endDate <= new Date()) throw new HttpError(400, "This challenge has already ended");

  const participant = await prisma.challengeParticipant.findUnique({
    where: { challengeId_userId: { challengeId, userId } }
  });
  if (!participant) throw new HttpError(400, "Join the challenge before checking in");

  const today = startOfDay(new Date());
  await prisma.challengeCheckIn.upsert({
    where: { challengeId_userId_date: { challengeId, userId, date: today } },
    create: { challengeId, userId, date: today },
    update: {}
  });

  emitFeedUpdate("challenge:checkin");

  return computeProgress(challengeId, userId, challenge.durationDays);
}
