import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { optionalString, requireEnum, requireInt, requireObject } from "../../shared/validation/validators.js";
import { completeOnboarding } from "./onboarding.service.js";

export async function postOnboarding(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  let gymTrainerId: string | null | undefined;
  if (body.gymTrainerId === null) {
    gymTrainerId = null;
  } else if (body.gymTrainerId !== undefined) {
    const gymTrainerRaw = optionalString(body, "gymTrainerId", { trim: true, max: 40 });
    gymTrainerId = gymTrainerRaw === undefined ? undefined : gymTrainerRaw.length === 0 ? null : gymTrainerRaw;
  }
  const payload = {
    heightCm: requireInt(body, "heightCm", { min: 100, max: 260 }),
    weightKg: Number(body.weightKg),
    age: requireInt(body, "age", { min: 12, max: 100 }),
    gender: requireEnum(body, "gender", ["FEMALE", "MALE", "OTHER"] as const),
    activityLevel: requireEnum(body, "activityLevel", ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "ATHLETE"] as const),
    goal: requireEnum(body, "goal", ["FAT_LOSS", "MUSCLE_BUILD", "LIFESTYLE"] as const),
    gymTrainerId
  };
  if (!Number.isFinite(payload.weightKg) || payload.weightKg < 30 || payload.weightKg > 300) throw new HttpError(400, "Invalid weightKg");

  const result = await completeOnboarding(req.userId!, payload);
  return jsonOk(res, result);
}

