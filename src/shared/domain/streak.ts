import { Prisma } from "@prisma/client";

const STREAK_LOOKBACK_DAYS = 400;
const MONTHLY_STREAK_FREEZES = 2;
const FREEZE_RESET_INTERVAL_DAYS = 30;

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function ensureFreezesReplenished(client: Prisma.TransactionClient, userId: string) {
  const user = await client.user.findUniqueOrThrow({
    where: { id: userId },
    select: { streakFreezesAvailable: true, streakFreezesResetAt: true }
  });

  if (user.streakFreezesResetAt && user.streakFreezesResetAt > new Date()) {
    return user.streakFreezesAvailable;
  }

  const nextReset = new Date();
  nextReset.setDate(nextReset.getDate() + FREEZE_RESET_INTERVAL_DAYS);
  await client.user.update({
    where: { id: userId },
    data: { streakFreezesAvailable: MONTHLY_STREAK_FREEZES, streakFreezesResetAt: nextReset }
  });
  return MONTHLY_STREAK_FREEZES;
}

export interface StreakRecomputeResult {
  streakCount: number;

  freezeUsedForDate?: string;
}

export async function recomputeStreakCount(client: Prisma.TransactionClient, userId: string): Promise<StreakRecomputeResult> {
  const freezesAvailable = await ensureFreezesReplenished(client, userId);

  const cutoff = startOfDay(new Date());
  cutoff.setDate(cutoff.getDate() - STREAK_LOOKBACK_DAYS);

  const recentDates = await client.streak.findMany({
    where: { userId, completed: true, date: { gte: cutoff } },
    select: { date: true },
    orderBy: { date: "desc" },
    take: STREAK_LOOKBACK_DAYS
  });
  const dateKeys = new Set(recentDates.map((d) => dateKey(d.date)));

  let currentStreak = 0;
  let freezeUsedForDate: string | undefined;
  const cursor = startOfDay(new Date());
  const today = dateKey(cursor);

  while (true) {
    const key = dateKey(cursor);
    if (dateKeys.has(key)) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (!freezeUsedForDate && freezesAvailable > 0 && key !== today) {
      await client.streak.upsert({
        where: { userId_date: { userId, date: cursor } },
        update: { completed: true, frozen: true },
        create: { userId, date: cursor, completed: true, frozen: true }
      });
      await client.user.update({ where: { id: userId }, data: { streakFreezesAvailable: { decrement: 1 } } });
      freezeUsedForDate = key;
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  await client.user.update({ where: { id: userId }, data: { streakCount: currentStreak } });
  return { streakCount: currentStreak, freezeUsedForDate };
}
