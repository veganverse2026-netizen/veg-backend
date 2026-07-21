import { prisma } from "../../infrastructure/db/prisma.js";
import { recomputeStreakCount } from "../../shared/domain/streak.js";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function listTrackers(userId: string) {
  // Newest first — with asc+take this used to return the oldest 14 rows
  // forever, so fresh logs vanished once a user had two weeks of history.
  // 180 rows comfortably covers the Progress page's 12-week heatmap.
  return await prisma.tracker.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 180
  });
}

/**
 * Dedicated paginated query for the Progress History table. Kept separate from
 * listTrackers (which stays a flat 180-row fetch) because the heatmap/streak/
 * weekly-compare widgets on the same page need that full recent window
 * regardless of which page of the history table is currently shown.
 */
export async function listTrackerHistoryPaginated(userId: string, page: number, limit: number) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const [total, entries] = await Promise.all([
    prisma.tracker.count({ where: { userId } }),
    prisma.tracker.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      skip,
      take: safeLimit
    })
  ]);

  return { entries, total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) };
}

export async function addTrackerEntry(
  userId: string,
  input: {
    weightKg?: number;
    caloriesConsumed?: number;
    proteinIntake?: number;
    workoutCompleted?: boolean;
    hydrationMl?: number;
    sleepHours?: number;
    bodyFatPercent?: number;
  }
) {
  const today = startOfDay(new Date());

  await prisma.tracker.create({
    data: {
      userId,
      weightKg: input.weightKg,
      caloriesConsumed: input.caloriesConsumed,
      proteinIntake: input.proteinIntake,
      workoutCompleted: input.workoutCompleted ?? false,
      hydrationMl: input.hydrationMl,
      sleepHours: input.sleepHours,
      bodyFatPercent: input.bodyFatPercent
    }
  });

  await prisma.streak.upsert({
    where: { userId_date: { userId, date: today } },
    update: { completed: true },
    create: { userId, date: today, completed: true }
  });

  const currentStreak = await recomputeStreakCount(prisma, userId);

  return { success: true, streakCount: currentStreak };
}

