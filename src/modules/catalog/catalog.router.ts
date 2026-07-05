import { Router } from "express";
import { optionalUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError } from "../../shared/http/json-response.js";
import { getCatalogRecipeById, getCatalogRecipes, getCatalogWorkouts } from "./catalog.controller.js";

export const catalogRouter = Router();

// Public endpoints — auth optional for browsing
catalogRouter.get("/recipes", optionalUser, async (_req: AuthedRequest, res) => {
  try {
    await getCatalogRecipes(_req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

catalogRouter.get("/recipes/:id", optionalUser, async (req: AuthedRequest, res) => {
  try {
    await getCatalogRecipeById(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

catalogRouter.get("/workouts", optionalUser, async (req: AuthedRequest, res) => {
  try {
    await getCatalogWorkouts(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
