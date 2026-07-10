import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { optionalString, requireObject, requireString } from "../../shared/validation/validators.js";
import {
  assignMealPlanToMember,
  deleteFavoriteMeal,
  getMemberMealPlanForTrainer,
  getMyMealPlan,
  getMyMealPlanRequest,
  getNutrientGuardian,
  getRecommendations,
  listFavoriteMeals,
  listMealRequestsForTrainer,
  requestRegeneration,
  markRequestInReview,
  reviewMealRequest,
  saveFavoriteMeal,
  selectMealPlan,
  updateMyMealPlan
} from "./meal-plans.service.js";
import { addMealLog, deleteMealLog, getDailySummary, listMealLogs } from "./meal-logs.service.js";
import { MEAL_LIBRARY } from "./meal-library.js";

const MAX_PLAN_JSON = 500000;

export async function getRecommendationsHandler(req: AuthedRequest, res: Response) {
  return jsonOk(res, await getRecommendations(req.userId!));
}

export async function getNutrients(req: AuthedRequest, res: Response) {
  return jsonOk(res, await getNutrientGuardian(req.userId!));
}

export async function getMinePlan(req: AuthedRequest, res: Response) {
  return jsonOk(res, await getMyMealPlan(req.userId!));
}

export async function postSelectPlan(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const planJson = requireString(body, "planJson", { trim: false, min: 2, max: MAX_PLAN_JSON });
  const reason = optionalString(body, "reason", { max: 200 });
  return jsonOk(res, await selectMealPlan(req.userId!, planJson, reason));
}

export async function postUpdatePlan(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const planJson = requireString(body, "planJson", { trim: false, min: 2, max: MAX_PLAN_JSON });
  const memberNote = optionalString(body, "memberNote", { max: 2000 });
  const reason = optionalString(body, "reason", { max: 200 });
  return jsonOk(res, await updateMyMealPlan(req.userId!, planJson, memberNote, reason));
}

/* "Ask my trainer to build it" — full plan or a single day */
export async function postRegenerationRequest(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const scope = requireString(body, "scope", { trim: true }) as "FULL_PLAN" | "DAY_SWAP" | "MEAL_SWAP";
  if (scope !== "FULL_PLAN" && scope !== "DAY_SWAP" && scope !== "MEAL_SWAP") throw new HttpError(400, "scope must be FULL_PLAN, DAY_SWAP or MEAL_SWAP");
  const day = optionalString(body, "day", { max: 20 });
  const slot = optionalString(body, "slot", { max: 30 });
  if ((scope === "DAY_SWAP" || scope === "MEAL_SWAP") && !day) throw new HttpError(400, "day is required");
  if (scope === "MEAL_SWAP" && !slot) throw new HttpError(400, "slot is required for MEAL_SWAP");
  const reason = optionalString(body, "reason", { max: 200 });
  const memberNote = optionalString(body, "memberNote", { max: 2000 });
  return jsonOk(res, await requestRegeneration(req.userId!, { scope, day, slot, reason, memberNote }), 201);
}

export async function getMyRequest(req: AuthedRequest, res: Response) {
  return jsonOk(res, await getMyMealPlanRequest(req.userId!));
}

/* trainer */
export async function getTrainerQueue(req: AuthedRequest, res: Response) {
  return jsonOk(res, await listMealRequestsForTrainer(req.userId!));
}

export async function postTrainerReview(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const requestId = requireString(body, "requestId", { trim: true, min: 10 });
  const action = requireString(body, "action", { trim: true }) as "approve" | "reject";
  if (action !== "approve" && action !== "reject") throw new HttpError(400, "action must be approve or reject");
  const trainerComment = optionalString(body, "trainerComment", { max: 2000 });
  const editedPlanJson = optionalString(body, "editedPlanJson", { trim: false, max: MAX_PLAN_JSON });
  const voiceNoteUrl = optionalString(body, "voiceNoteUrl", { trim: true, max: 2000 });
  return jsonOk(res, await reviewMealRequest(req.userId!, requestId, action, trainerComment, editedPlanJson, voiceNoteUrl));
}

export async function postStartReview(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  return jsonOk(res, await markRequestInReview(req.userId!, id));
}

export async function getMealLibrary(_req: AuthedRequest, res: Response) {
  return jsonOk(res, MEAL_LIBRARY);
}

export async function postTrainerAssign(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const memberId = requireString(body, "memberId", { trim: true, min: 8 });
  const planJson = requireString(body, "planJson", { trim: false, min: 2, max: MAX_PLAN_JSON });
  return jsonOk(res, await assignMealPlanToMember(req.userId!, memberId, planJson), 201);
}

export async function getMemberPlanForTrainer(req: AuthedRequest, res: Response) {
  const memberId = String(req.params.id ?? "").trim();
  return jsonOk(res, await getMemberMealPlanForTrainer(req.userId!, memberId));
}

/* favorites */
export async function getFavorites(req: AuthedRequest, res: Response) {
  return jsonOk(res, await listFavoriteMeals(req.userId!));
}

export async function postFavorite(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const mealJson = requireString(body, "mealJson", { trim: false, min: 2, max: 20000 });
  return jsonOk(res, await saveFavoriteMeal(req.userId!, mealJson), 201);
}

export async function deleteFavorite(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  return jsonOk(res, await deleteFavoriteMeal(req.userId!, id));
}

/* logs */
export async function getLogs(req: AuthedRequest, res: Response) {
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  return jsonOk(res, await listMealLogs(req.userId!, date));
}

export async function postLog(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const slot = requireString(body, "slot", { trim: true, min: 3, max: 30 });
  const name = requireString(body, "name", { trim: true, min: 1, max: 200 });
  const quantity = optionalString(body, "quantity", { max: 60 });
  const statusStr = optionalString(body, "status", { max: 20 });
  if (statusStr && statusStr !== "completed" && statusStr !== "skipped") {
    throw new HttpError(400, "status must be completed or skipped");
  }
  const num = (key: string) => {
    const v = (body as any)[key];
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `Invalid ${key}`);
    return n;
  };
  const log = await addMealLog(req.userId!, {
    slot, name, quantity,
    status: (statusStr as "completed" | "skipped" | undefined) ?? "completed",
    calories: num("calories"), protein: num("protein"), carbs: num("carbs"),
    fat: num("fat"), fiber: num("fiber"), waterMl: num("waterMl")
  });
  return jsonOk(res, log, 201);
}

export async function deleteLog(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  return jsonOk(res, await deleteMealLog(req.userId!, id));
}

export async function getSummary(req: AuthedRequest, res: Response) {
  const date = typeof req.query.date === "string" ? req.query.date : undefined;
  return jsonOk(res, await getDailySummary(req.userId!, date));
}
