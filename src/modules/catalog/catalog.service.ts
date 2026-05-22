import { prisma } from "../../infrastructure/db/prisma.js";

export async function listRecipes() {
  return await prisma.recipe.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getRecipe(id: string) {
  return await prisma.recipe.findUnique({ where: { id } });
}

export async function listWorkouts(goal?: "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE") {
  return await prisma.workout.findMany({
    where: goal ? { goal: goal as any } : undefined,
    orderBy: { durationMin: "asc" }
  });
}

