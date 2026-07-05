import { prisma } from "../../infrastructure/db/prisma.js";

const MAX_CATALOG_ITEMS = 500;

export async function listRecipes() {
  return await prisma.recipe.findMany({ take: MAX_CATALOG_ITEMS, orderBy: { createdAt: "asc" } });
}

export async function getRecipe(id: string) {
  return await prisma.recipe.findUnique({ where: { id } });
}

export async function listWorkouts(goal?: "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE") {
  return await prisma.workout.findMany({
    take: MAX_CATALOG_ITEMS,
    where: goal ? { goal: goal as any } : undefined,
    orderBy: { durationMin: "asc" }
  });
}

