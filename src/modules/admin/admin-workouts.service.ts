import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

export async function adminListWorkouts(opts: { goal?: string; type?: string }) {
  const where: Record<string, unknown> = {};
  if (opts.goal) where.goal = opts.goal;
  if (opts.type) where.type = opts.type;
  return prisma.workout.findMany({
    where: where as any,
    orderBy: [{ goal: "asc" }, { durationMin: "asc" }],
  });
}

export async function adminCreateWorkout(input: {
  title: string;
  description: string;
  type: "HOME" | "GYM";
  goal: "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE";
  durationMin: number;
  level: string;
  imageUrl?: string | null;
  rating?: number | null;
}) {
  return prisma.workout.create({ data: input });
}

export async function adminUpdateWorkout(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    type: "HOME" | "GYM";
    goal: "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE";
    durationMin: number;
    level: string;
    imageUrl: string | null;
    rating: number | null;
  }>
) {
  const existing = await prisma.workout.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Workout not found");
  return prisma.workout.update({ where: { id }, data: input as any });
}

export async function adminDeleteWorkout(id: string) {
  const existing = await prisma.workout.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Workout not found");
  await prisma.workout.delete({ where: { id } });
  return { success: true };
}
