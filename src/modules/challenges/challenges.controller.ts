import type { Response } from "express";
import { jsonOk } from "../../shared/http/json-response.js";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { optionalString, requireEnum, requireInt, requireObject, requireString } from "../../shared/validation/validators.js";
import {
  checkInChallenge,
  createChallenge,
  getChallengeDetail,
  joinChallenge,
  leaveChallenge,
  listActiveChallenges
} from "./challenges.service.js";

const CATEGORIES = ["MEAL", "WORKOUT", "STEPS", "WATER", "MEDITATION", "RECIPE", "GYM_PROGRESS", "CUSTOM"] as const;
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export async function getChallenges(req: AuthedRequest, res: Response) {
  const result = await listActiveChallenges(req.userId);
  return jsonOk(res, result);
}

export async function getChallenge(req: AuthedRequest, res: Response) {
  const result = await getChallengeDetail(req.params.id, req.userId);
  return jsonOk(res, result);
}

export async function postChallenge(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const title = requireString(body, "title", { trim: true, min: 3, max: 120 });
  const description = requireString(body, "description", { trim: true, min: 1, max: 1000 });
  const durationDays = requireInt(body, "durationDays", { min: 1, max: 365 });
  const category = requireEnum(body, "category", CATEGORIES);
  const difficulty = requireEnum(body, "difficulty", DIFFICULTIES);
  const coverImageUrl = optionalString(body, "coverImageUrl", { max: 2000 });
  const rules = optionalString(body, "rules", { max: 2000 });
  const rewardText = optionalString(body, "rewardText", { max: 500 });
  const result = await createChallenge(req.userId!, {
    title,
    description,
    durationDays,
    category,
    difficulty,
    coverImageUrl,
    rules,
    rewardText
  });
  return jsonOk(res, result, 201);
}

export async function postChallengeJoin(req: AuthedRequest, res: Response) {
  const result = await joinChallenge(req.userId!, req.params.id);
  return jsonOk(res, result);
}

export async function postChallengeLeave(req: AuthedRequest, res: Response) {
  const result = await leaveChallenge(req.userId!, req.params.id);
  return jsonOk(res, result);
}

export async function postChallengeCheckIn(req: AuthedRequest, res: Response) {
  const result = await checkInChallenge(req.userId!, req.params.id);
  return jsonOk(res, result);
}
