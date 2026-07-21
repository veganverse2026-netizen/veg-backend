import { Prisma } from "@prisma/client";

// Shared between tracker.service.ts's addTrackerEntry and workout-logs.service.ts's
// markWorkoutCompletedForStreak so both compute the consecutive-day streak the
// same way, from the same bounded query — this used to be copy-pasted in both
// places with an unbounded findMany (no `take`, no date floor), which meant every
// tracker entry and every workout completion re-fetched a long-tenured user's
// ENTIRE Streak history just to walk back a few days.
const STREAK_LOOKBACK_DAYS = 400;

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Recomputes the caller's current consecutive-day streak from Streak rows no
 * older than STREAK_LOOKBACK_DAYS (~13 months — comfortably beyond any
 * realistic unbroken streak) and persists it to User.streakCount. Caller is
 * responsible for upserting today's Streak row first.
 */
export async function recomputeStreakCount(client: Prisma.TransactionClient, userId: string): Promise<number> {
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
  const cursor = startOfDay(new Date());
  while (dateKeys.has(dateKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  await client.user.update({ where: { id: userId }, data: { streakCount: currentStreak } });
  return currentStreak;
}
