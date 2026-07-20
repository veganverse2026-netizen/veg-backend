import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError } from "../../shared/http/json-response.js";
import { getStrengthGoals, putStrengthGoal } from "./strength-goals.controller.js";

export const strengthGoalsRouter = Router();

strengthGoalsRouter.get("/strength-goals", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getStrengthGoals(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

strengthGoalsRouter.put("/strength-goals", requireUser, async (req: AuthedRequest, res) => {
  try {
    await putStrengthGoal(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
