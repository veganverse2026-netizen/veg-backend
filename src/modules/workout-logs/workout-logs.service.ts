import { prisma } from "../../infrastructure/db/prisma.js";

type Pr = { exercise: string; bestWeightKg: number; bestVolume: number; updatedAt: Date };

function computePrs(logs: Array<{ exercise: string; sets: number; reps: number; weightKg: number; performedAt: Date }>): Pr[] {
  const byExercise = new Map<string, Pr>();
  for (const log of logs.slice(0, 200)) {
    const key = log.exercise.trim().toLowerCase();
    const volume = log.sets * log.reps * log.weightKg;
    const current = byExercise.get(key);
    if (!current || log.weightKg > current.bestWeightKg || (log.weightKg === current.bestWeightKg && volume > current.bestVolume)) {
      byExercise.set(key, { exercise: log.exercise, bestWeightKg: log.weightKg, bestVolume: volume, updatedAt: log.performedAt });
    }
  }
  return Array.from(byExercise.values())
    .sort((a, b) => b.bestWeightKg - a.bestWeightKg)
    .slice(0, 8);
}

export async function listWorkoutLogsWithPrs(userId: string) {
  const logs = await prisma.workoutLog.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    take: 40
  });
  const prs = computePrs(logs);
  return { logs, prs };
}

export async function createWorkoutLog(
  userId: string,
  input: {
    performedAt: Date;
    exercise: string;
    sets: number;
    reps: number;
    weightKg: number;
    notes?: string | null;
  }
) {
  const created = await prisma.workoutLog.create({
    data: {
      userId,
      performedAt: input.performedAt,
      exercise: input.exercise,
      sets: input.sets,
      reps: input.reps,
      weightKg: input.weightKg,
      notes: input.notes?.trim() || null
    }
  });

  const { logs, prs } = await listWorkoutLogsWithPrs(userId);
  return { success: true, log: created, logs, prs };
}

