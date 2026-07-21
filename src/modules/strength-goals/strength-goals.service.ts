import { prisma } from "../../infrastructure/db/prisma.js";

export async function listStrengthGoals(userId: string) {
  return await prisma.strengthGoal.findMany({ where: { userId } });
}

export async function upsertStrengthGoal(userId: string, exercise: string, targetWeightKg: number) {
  return await prisma.strengthGoal.upsert({
    where: { userId_exercise: { userId, exercise } },
    update: { targetWeightKg },
    create: { userId, exercise, targetWeightKg }
  });
}

export async function deleteStrengthGoal(userId: string, exercise: string) {
  const existing = await prisma.strengthGoal.findUnique({ where: { userId_exercise: { userId, exercise } } });
  if (!existing) return null;
  await prisma.strengthGoal.delete({ where: { userId_exercise: { userId, exercise } } });
  return { ok: true };
}
