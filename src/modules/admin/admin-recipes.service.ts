import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { RecipeCategory } from "@prisma/client";

const VALID_CATEGORIES: RecipeCategory[] = ["FAT_LOSS", "MUSCLE_BUILD", "LIFESTYLE"];

export async function adminListRecipes(opts: { page?: number; limit?: number; category?: RecipeCategory }) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, opts.limit ?? 20);
  const skip = (page - 1) * limit;
  const where = opts.category ? { category: opts.category } : undefined;
  const [total, items] = await Promise.all([
    prisma.recipe.count({ where }),
    prisma.recipe.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);
  return { total, page, limit, pages: Math.ceil(total / limit) || 1, items };
}

export async function adminCreateRecipe(input: {
  name: string; image: string; category: RecipeCategory; description: string;
  ingredients: string[]; steps: string[]; calories: number; protein: number;
  carbs: number; fats: number; isCheatMeal?: boolean;
}) {
  if (!VALID_CATEGORIES.includes(input.category)) throw new HttpError(400, "Invalid category");
  return prisma.recipe.create({ data: { ...input, isCheatMeal: input.isCheatMeal ?? false } });
}

export async function adminUpdateRecipe(id: string, input: Partial<{
  name: string; image: string; category: RecipeCategory; description: string;
  ingredients: string[]; steps: string[]; calories: number; protein: number;
  carbs: number; fats: number; isCheatMeal: boolean;
}>) {
  const r = await prisma.recipe.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "Recipe not found");
  if (input.category && !VALID_CATEGORIES.includes(input.category)) throw new HttpError(400, "Invalid category");
  return prisma.recipe.update({ where: { id }, data: input as any });
}

export async function adminDeleteRecipe(id: string) {
  const r = await prisma.recipe.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "Recipe not found");
  await prisma.recipe.delete({ where: { id } });
  return { ok: true };
}
