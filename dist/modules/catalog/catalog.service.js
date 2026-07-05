import { prisma } from "../../infrastructure/db/prisma.js";
export async function listRecipes() {
    return await prisma.recipe.findMany({ orderBy: { createdAt: "asc" } });
}
export async function getRecipe(id) {
    return await prisma.recipe.findUnique({ where: { id } });
}
export async function listWorkouts(goal) {
    return await prisma.workout.findMany({
        where: goal ? { goal: goal } : undefined,
        orderBy: { durationMin: "asc" }
    });
}
