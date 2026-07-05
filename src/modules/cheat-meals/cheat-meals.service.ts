import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

function weekStartDate(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function selectCheatMeal(userId: string, recipeId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found");
  if (user.goal !== "LIFESTYLE") throw new HttpError(403, "Cheat meals are available only for Lifestyle users");

  const now = new Date();
  const weekStart = weekStartDate(now);

  try {
    // Serializable isolation turns the check-then-create below into an
    // atomic operation: if two requests race for the same user/week, the
    // database aborts one with a serialization conflict instead of letting
    // both create a row.
    await prisma.$transaction(
      async (tx) => {
        const existingSelection = await tx.cheatMeal.findFirst({
          where: { userId, weekStart, expiresAt: { gt: now } }
        });
        if (existingSelection) throw new HttpError(400, "You already selected this week's cheat meal");

        await tx.cheatMeal.create({
          data: {
            userId,
            recipeId,
            weekStart,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
          }
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err: any) {
    if (err instanceof HttpError) throw err;
    // Postgres serialization failure (40001) from a concurrent conflicting transaction.
    if (err?.code === "P2034") throw new HttpError(409, "You already selected this week's cheat meal");
    throw err;
  }

  return { success: true };
}

export async function getCheatMealOptions(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.goal !== "LIFESTYLE") {
    return { enabled: false, options: [], selectedRecipeId: null };
  }

  const now = new Date();
  const weekStart = weekStartDate(now);
  const selected = await prisma.cheatMeal.findFirst({ where: { userId, weekStart, expiresAt: { gt: now } } });
  const options = await prisma.recipe.findMany({
    where: { isCheatMeal: true, category: "LIFESTYLE" },
    take: 3,
    orderBy: { createdAt: "asc" }
  });

  return { enabled: true, options, selectedRecipeId: selected?.recipeId ?? null };
}

