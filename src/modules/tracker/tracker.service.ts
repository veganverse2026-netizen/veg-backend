import { prisma } from "../../infrastructure/db/prisma.js";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
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

export async function addTrackerEntry(
  userId: string,
  input: {
    weightKg?: number;
    caloriesConsumed?: number;
    proteinIntake?: number;
    workoutCompleted?: boolean;
  }
) {
  const today = startOfDay(new Date());

  await prisma.tracker.create({
    data: {
      userId,
      weightKg: input.weightKg,
      caloriesConsumed: input.caloriesConsumed,
      proteinIntake: input.proteinIntake,
      workoutCompleted: input.workoutCompleted ?? false
    }
  });

  await prisma.streak.upsert({
    where: { userId_date: { userId, date: today } },
    update: { completed: true },
    create: { userId, date: today, completed: true }
  });

  // A real consecutive-day streak, not a lifetime "days active" count — walk
  // backward from today while a completed streak entry exists for each day.
  const allDates = await prisma.streak.findMany({
    where: { userId, completed: true },
    select: { date: true }
  });
  const dateKeys = new Set(allDates.map((d) => dateKey(d.date)));
  let currentStreak = 0;
  const cursor = startOfDay(new Date());
  while (dateKeys.has(dateKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  await prisma.user.update({ where: { id: userId }, data: { streakCount: currentStreak } });

  return { success: true, streakCount: currentStreak };
}

