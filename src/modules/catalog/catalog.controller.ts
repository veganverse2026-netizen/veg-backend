import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { requireEnum, requireObject } from "../../shared/validation/validators.js";
import { getRecipe, listRecipes, listWorkouts } from "./catalog.service.js";

export async function getCatalogRecipes(_req: AuthedRequest, res: Response) {
  const recipes = await listRecipes();
  return jsonOk(res, recipes);
}

export async function getCatalogRecipeById(req: AuthedRequest, res: Response) {
  const recipe = await getRecipe(req.params.id);
  return jsonOk(res, recipe);
}

export async function getCatalogWorkouts(req: AuthedRequest, res: Response) {
  const q = requireObject(req.query);
  const goal = (q.goal ? requireEnum(q, "goal", ["FAT_LOSS", "MUSCLE_BUILD", "LIFESTYLE"] as const) : undefined) as any;
  const workouts = await listWorkouts(goal);
  return jsonOk(res, workouts);
}

