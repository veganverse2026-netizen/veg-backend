import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { adminListRecipes, adminCreateRecipe, adminUpdateRecipe, adminDeleteRecipe } from "./admin-recipes.service.js";
import type { RecipeCategory } from "@prisma/client";

export async function getAdminRecipes(req: AuthedRequest, res: Response) {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const category = req.query.category as RecipeCategory | undefined;
  return jsonOk(res, await adminListRecipes({ page, limit, category }));
}

export async function postAdminRecipe(req: AuthedRequest, res: Response) {
  const b = req.body as any;
  if (!b.name?.trim()) throw new HttpError(400, "name required");
  if (!b.category) throw new HttpError(400, "category required");
  return jsonOk(res, await adminCreateRecipe({
    name: b.name.trim(), image: b.image?.trim() ?? "", category: b.category,
    description: b.description?.trim() ?? "", ingredients: Array.isArray(b.ingredients) ? b.ingredients : [],
    steps: Array.isArray(b.steps) ? b.steps : [], calories: Number(b.calories) || 0,
    protein: Number(b.protein) || 0, carbs: Number(b.carbs) || 0, fats: Number(b.fats) || 0,
    isCheatMeal: Boolean(b.isCheatMeal),
  }));
}

export async function patchAdminRecipe(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!id) throw new HttpError(400, "id required");
  const b = req.body as any;
  const update: any = {};
  if (b.name !== undefined) update.name = String(b.name).trim();
  if (b.image !== undefined) update.image = String(b.image).trim();
  if (b.category !== undefined) update.category = b.category;
  if (b.description !== undefined) update.description = String(b.description).trim();
  if (b.ingredients !== undefined) update.ingredients = b.ingredients;
  if (b.steps !== undefined) update.steps = b.steps;
  if (b.calories !== undefined) update.calories = Number(b.calories);
  if (b.protein !== undefined) update.protein = Number(b.protein);
  if (b.carbs !== undefined) update.carbs = Number(b.carbs);
  if (b.fats !== undefined) update.fats = Number(b.fats);
  if (b.isCheatMeal !== undefined) update.isCheatMeal = Boolean(b.isCheatMeal);
  return jsonOk(res, await adminUpdateRecipe(id, update));
}

export async function deleteAdminRecipe(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!id) throw new HttpError(400, "id required");
  return jsonOk(res, await adminDeleteRecipe(id));
}
