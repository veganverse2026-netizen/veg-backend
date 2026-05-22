import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { getCatalogRecipeById, getCatalogRecipes, getCatalogWorkouts } from "./catalog.controller.js";

export const catalogRouter = Router();

catalogRouter.get("/recipes", requireUser, async (_req: AuthedRequest, res) => {
  try {
    await getCatalogRecipes(_req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

catalogRouter.get("/recipes/:id", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getCatalogRecipeById(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

catalogRouter.get("/workouts", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getCatalogWorkouts(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
