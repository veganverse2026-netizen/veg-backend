import { prisma } from "../../infrastructure/db/prisma.js";
import { getIo } from "../../infrastructure/realtime/socket.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { createNotification } from "../notifications/notifications.service.js";
import { checkAndAwardBadges } from "../../shared/domain/badges.js";

const MAX_ACTIVE_CHALLENGES = 20;

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Pure/read-only — no writes, safe to call from anywhere a participant's
 * progress is merely being displayed (challenge detail, leaderboard). Streak
 * freeze BRIDGING (writing a frozen check-in) only ever happens in
 * bridgeChallengeFreezeIfNeeded, called exclusively from checkInChallenge —
 * viewing a leaderboard must never spend someone else's freeze as a side
 * effect of computing their row.
 */
function computeProgressReadOnly(checkIns: { date: Date }[], durationDays: number, joinedAt: Date) {
  const completedDays = checkIns.length;
  const progressPercent = Math.min(100, Math.round((completedDays / durationDays) * 100));

  const dateKeys = new Set(checkIns.map((c) => dateKey(c.date)));
  const checkedInToday = dateKeys.has(dateKey(startOfDay(new Date())));
  const joinedKey = dateKey(startOfDay(joinedAt));

  let currentStreak = 0;
  const cursor = startOfDay(new Date());
  while (true) {
    const key = dateKey(cursor);
    if (key < joinedKey || !dateKeys.has(key)) break;
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { completedDays, progressPercent, currentStreak, checkedInToday };
}

async function getProgressForUser(challengeId: string, userId: string, durationDays: number) {
  const participant = await prisma.challengeParticipant.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
    select: { freezesAvailable: true, joinedAt: true }
  });
  if (!participant) throw new HttpError(400, "Not a participant");

  const checkIns = await prisma.challengeCheckIn.findMany({
    where: { challengeId, userId },
    select: { date: true }
  });

  return {
    ...computeProgressReadOnly(checkIns, durationDays, participant.joinedAt),
    freezesAvailable: participant.freezesAvailable
  };
}

/**
 * Bridges exactly one missed day immediately before today's run with the
 * participant's single per-challenge grace freeze (see ChallengeParticipant
 * .freezesAvailable) — only ever called right after a real check-in, from
 * checkInChallenge. A day already covered (real or previously-frozen) is
 * left alone; only a genuine gap consumes the freeze, and only one gap ever,
 * per the one-grace-day design (a longer absence still breaks the streak).
 */
async function bridgeChallengeFreezeIfNeeded(challengeId: string, userId: string, joinedAt: Date) {
  const participant = await prisma.challengeParticipant.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
    select: { freezesAvailable: true }
  });
  if (!participant || participant.freezesAvailable <= 0) return undefined;

  const checkIns = await prisma.challengeCheckIn.findMany({
    where: { challengeId, userId },
    select: { date: true }
  });
  const dateKeys = new Set(checkIns.map((c) => dateKey(c.date)));
  const joinedKey = dateKey(startOfDay(joinedAt));
  const today = dateKey(startOfDay(new Date()));

  const cursor = startOfDay(new Date());
  while (dateKeys.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  const gapKey = dateKey(cursor);
  if (gapKey < joinedKey || gapKey === today) return undefined;

  await prisma.challengeCheckIn.upsert({
    where: { challengeId_userId_date: { challengeId, userId, date: cursor } },
    update: { frozen: true },
    create: { challengeId, userId, date: cursor, frozen: true }
  });
  await prisma.challengeParticipant.update({
    where: { challengeId_userId: { challengeId, userId } },
    data: { freezesAvailable: { decrement: 1 } }
  });
  return gapKey;
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
  const progress = joined ? await getProgressForUser(challenge.id, userId!, challenge.durationDays) : null;

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

  const freezeUsedForDate = await bridgeChallengeFreezeIfNeeded(challengeId, userId, participant.joinedAt);

  emitFeedUpdate("challenge:checkin");

  const progress = await getProgressForUser(challengeId, userId, challenge.durationDays);
  const { newlyEarned } = await checkAndAwardBadges(userId);
  return { ...progress, freezeUsedForDate, newlyEarnedBadges: newlyEarned };
}

/**
 * Segment-style ranking within one challenge — by total completed days,
 * tie-broken by current streak. Read-only (uses computeProgressReadOnly),
 * so viewing this never spends anyone's freeze.
 */
export async function getChallengeLeaderboard(challengeId: string) {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId }, select: { durationDays: true } });
  if (!challenge) throw new HttpError(404, "Challenge not found");

  const participants = await prisma.challengeParticipant.findMany({
    where: { challengeId },
    select: { userId: true, joinedAt: true, user: { select: { id: true, name: true, image: true } } }
  });

  const rows = await Promise.all(
    participants.map(async (p) => {
      const checkIns = await prisma.challengeCheckIn.findMany({
        where: { challengeId, userId: p.userId },
        select: { date: true }
      });
      const progress = computeProgressReadOnly(checkIns, challenge.durationDays, p.joinedAt);
      return {
        userId: p.userId,
        name: p.user.name,
        image: p.user.image,
        completedDays: progress.completedDays,
        currentStreak: progress.currentStreak
      };
    })
  );

  rows.sort((a, b) => b.completedDays - a.completedDays || b.currentStreak - a.currentStreak);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

const MAX_MESSAGE_LENGTH = 1000;
const MESSAGES_PAGE_SIZE = 50;

async function requireChallengeParticipant(challengeId: string, userId: string) {
  const participant = await prisma.challengeParticipant.findUnique({
    where: { challengeId_userId: { challengeId, userId } }
  });
  if (!participant) throw new HttpError(403, "Join the challenge to see its discussion");
}

/** Club-style chat scoped to one challenge — participant-only, not public like the main feed. */
export async function listChallengeMessages(challengeId: string, userId: string) {
  await requireChallengeParticipant(challengeId, userId);
  const messages = await prisma.challengeMessage.findMany({
    where: { challengeId },
    orderBy: { createdAt: "desc" },
    take: MESSAGES_PAGE_SIZE,
    include: { user: { select: { id: true, name: true, image: true } } }
  });
  return messages.reverse();
}

export async function postChallengeMessage(challengeId: string, userId: string, textRaw: string) {
  await requireChallengeParticipant(challengeId, userId);
  const text = textRaw?.trim() ?? "";
  if (text.length < 1) throw new HttpError(400, "Message can't be empty");
  if (text.length > MAX_MESSAGE_LENGTH) throw new HttpError(400, "Message is too long");

  const message = await prisma.challengeMessage.create({
    data: { challengeId, userId, text },
    include: { user: { select: { id: true, name: true, image: true } } }
  });

  try {
    getIo().to(`challenge:${challengeId}`).emit("challenge:message", message);
  } catch {
    // io may be unavailable in some runtimes (e.g. tests)
  }

  return message;
}
