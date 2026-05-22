import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { getSavedRecipes, postSaveRecipe } from "./recipes.controller.js";

export const recipesRouter = Router();

recipesRouter.get("/recipes/saved", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getSavedRecipes(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

recipesRouter.post("/recipes/save", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postSaveRecipe(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
