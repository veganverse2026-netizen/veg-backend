import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import {
  optionalString,
  requireEmail,
  requireEnum,
  requireInt,
  requireObject,
  requireString
} from "../../shared/validation/validators.js";
import { getPublicUserById, getUserById, getUserStats, searchUsers, updateUserProfile } from "./users.service.js";

export async function getMe(req: AuthedRequest, res: Response) {
  const user = await getUserById(req.userId!);
  return jsonOk(res, user);
}

export async function getUser(req: AuthedRequest, res: Response) {
  const isSelf = req.params.id === req.userId;
  const user = isSelf ? await getUserById(req.params.id) : await getPublicUserById(req.params.id);
  if (!user) throw new HttpError(404, "User not found");
  return jsonOk(res, user);
}

export async function patchMe(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);

  const name = optionalString(body, "name", { trim: true, max: 120 });
  const image = optionalString(body, "image", { trim: true, max: 1000 });

  let email: string | undefined;
  if (body.email != null) email = requireEmail(body, "email");

  let gymTrainerId: string | null | undefined;
  if (body.gymTrainerId === null) {
    gymTrainerId = null;
  } else if (body.gymTrainerId !== undefined) {
    gymTrainerId = requireString(body, "gymTrainerId", { trim: true, min: 10, max: 40 });
  }

  let heightCm: number | undefined;
  if (body.heightCm !== undefined && body.heightCm !== null) {
    const v = Number(body.heightCm);
    if (!Number.isFinite(v) || v < 100 || v > 260) throw new HttpError(400, "Invalid heightCm");
    heightCm = v;
  }

  let weightKg: number | undefined;
  if (body.weightKg !== undefined && body.weightKg !== null) {
    const v = Number(body.weightKg);
    if (!Number.isFinite(v) || v < 30 || v > 300) throw new HttpError(400, "Invalid weightKg");
    weightKg = v;
  }

  let age: number | undefined;
  if (body.age !== undefined && body.age !== null) {
    age = requireInt(body, "age", { min: 12, max: 100 });
  }

  let gender: "FEMALE" | "MALE" | "OTHER" | undefined;
  if (body.gender !== undefined && body.gender !== null) {
    gender = requireEnum(body, "gender", ["FEMALE", "MALE", "OTHER"] as const);
  }

  let activityLevel: "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "ATHLETE" | undefined;
  if (body.activityLevel !== undefined && body.activityLevel !== null) {
    activityLevel = requireEnum(body, "activityLevel", ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "ATHLETE"] as const);
  }

  let goal: "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE" | undefined;
  if (body.goal !== undefined && body.goal !== null) {
    goal = requireEnum(body, "goal", ["FAT_LOSS", "MUSCLE_BUILD", "LIFESTYLE"] as const);
  }

  const updated = await updateUserProfile(req.userId!, {
    name: name == null ? undefined : name,
    email: email == null ? undefined : email,
    image: image == null ? undefined : image,
    gymTrainerId,
    ...(heightCm !== undefined ? { heightCm } : {}),
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(age !== undefined ? { age } : {}),
    ...(gender !== undefined ? { gender } : {}),
    ...(activityLevel !== undefined ? { activityLevel } : {}),
    ...(goal !== undefined ? { goal } : {})
  });

  return jsonOk(res, updated);
}

export async function getMeStats(req: AuthedRequest, res: Response) {
  const stats = await getUserStats(req.userId!);
  return jsonOk(res, stats);
}

export async function getUsersSearch(req: AuthedRequest, res: Response) {
  const searchText = typeof (req.query as any)?.q === "string" ? String((req.query as any).q) : "";
  const requestedLimitRaw = (req.query as any)?.limit;
  const requestedLimit =
    typeof requestedLimitRaw === "string" ? Number(requestedLimitRaw) : typeof requestedLimitRaw === "number" ? requestedLimitRaw : 10;
  const safeLimit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(20, Math.floor(requestedLimit))) : 10;

  const results = await searchUsers(searchText, safeLimit);
  return jsonOk(res, results);
}

