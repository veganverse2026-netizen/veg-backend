import { prisma } from "../../infrastructure/db/prisma.js";

export async function listSavedRecipes(userId: string) {
  return await prisma.savedRecipe.findMany({
    where: { userId },
    include: { recipe: true },
    orderBy: { createdAt: "desc" }
  });
}

export async function saveRecipe(userId: string, recipeId: string) {
  await prisma.savedRecipe.upsert({
    where: { userId_recipeId: { userId, recipeId } },
    update: {},
    create: { userId, recipeId }
  });
  return { success: true };
}

