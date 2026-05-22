import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { getCheatMealOptionsHandler, postCheatMealSelect } from "./cheat-meals.controller.js";

export const cheatMealsRouter = Router();

cheatMealsRouter.post("/cheat-meals/select", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postCheatMealSelect(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

cheatMealsRouter.get("/cheat-meals/options", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getCheatMealOptionsHandler(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
