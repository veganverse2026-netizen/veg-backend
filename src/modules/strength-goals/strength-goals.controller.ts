import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { requireObject, requireString } from "../../shared/validation/validators.js";
import { listStrengthGoals, upsertStrengthGoal, deleteStrengthGoal } from "./strength-goals.service.js";

export async function getStrengthGoals(req: AuthedRequest, res: Response) {
  const goals = await listStrengthGoals(req.userId!);
  return jsonOk(res, goals);
}

export async function putStrengthGoal(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const exercise = requireString(body, "exercise", { trim: true, min: 2, max: 120 });
  const targetWeightKg = Number((body as Record<string, unknown>).targetWeightKg);
  if (!Number.isFinite(targetWeightKg) || targetWeightKg <= 0 || targetWeightKg > 1000) {
    throw new HttpError(400, "Invalid targetWeightKg");
  }
  const goal = await upsertStrengthGoal(req.userId!, exercise, targetWeightKg);
  return jsonOk(res, goal);
}

export async function removeStrengthGoal(req: AuthedRequest, res: Response) {
  const exercise = decodeURIComponent(req.params.exercise ?? "").trim();
  if (!exercise) throw new HttpError(400, "exercise required");
  const result = await deleteStrengthGoal(req.userId!, exercise);
  if (!result) throw new HttpError(404, "Strength goal not found");
  return jsonOk(res, result);
}
