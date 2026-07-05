import { prisma } from "../../infrastructure/db/prisma.js";
export async function listSavedRecipes(userId) {
    return await prisma.savedRecipe.findMany({
        where: { userId },
        include: { recipe: true },
        orderBy: { createdAt: "desc" }
    });
}
export async function saveRecipe(userId, recipeId) {
    await prisma.savedRecipe.upsert({
        where: { userId_recipeId: { userId, recipeId } },
        update: {},
        create: { userId, recipeId }
    });
    return { success: true };
}
