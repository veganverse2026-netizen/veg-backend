import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { optionalNumber, optionalString, optionalStringArray, requireEnum, requireInt, requireObject } from "../../shared/validation/validators.js";
import { DIETARY_PREFERENCES, DIETARY_STYLES, normalizeDietaryPreferences } from "../../shared/constants/dietary.js";
import { completeOnboarding } from "./onboarding.service.js";
import {
  computeTDEE, evaluateGoalPace, computeGoalCalorieTarget, computeMacroTargets,
  computeHydrationTarget, predictWeeklyProgress, type GoalKind
} from "../../shared/domain/calorieEngine.js";

export async function postOnboarding(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  let gymTrainerId: string | null | undefined;
  if (body.gymTrainerId === null) {
    gymTrainerId = null;
  } else if (body.gymTrainerId !== undefined) {
    const gymTrainerRaw = optionalString(body, "gymTrainerId", { trim: true, max: 40 });
    gymTrainerId = gymTrainerRaw === undefined ? undefined : gymTrainerRaw.length === 0 ? null : gymTrainerRaw;
  }
  const dietaryStyleRaw = optionalString(body, "dietaryStyle", { trim: true, max: 40 });
  if (dietaryStyleRaw !== undefined && !DIETARY_STYLES.includes(dietaryStyleRaw as any)) {
    throw new HttpError(400, "Invalid dietaryStyle");
  }

  const bodyFatPercent = optionalNumber(body, "bodyFatPercent");
  if (bodyFatPercent !== undefined && (bodyFatPercent < 1 || bodyFatPercent > 70)) {
    throw new HttpError(400, "Invalid bodyFatPercent");
  }

  const goalTargetWeightKg = optionalNumber(body, "goalTargetWeightKg");
  if (goalTargetWeightKg !== undefined && (goalTargetWeightKg < 20 || goalTargetWeightKg > 300)) {
    throw new HttpError(400, "Invalid goalTargetWeightKg");
  }
  const goalTimelineWeeks = optionalNumber(body, "goalTimelineWeeks");
  if (goalTimelineWeeks !== undefined && (!Number.isInteger(goalTimelineWeeks) || goalTimelineWeeks < 1 || goalTimelineWeeks > 104)) {
    throw new HttpError(400, "Invalid goalTimelineWeeks");
  }
  const goalTargetDateRaw = optionalString(body, "goalTargetDate", { trim: true });
  let goalTargetDate: Date | undefined;
  if (goalTargetDateRaw !== undefined) {
    const d = new Date(goalTargetDateRaw);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid goalTargetDate");
    goalTargetDate = d;
  }

  const payload = {
    heightCm: requireInt(body, "heightCm", { min: 50, max: 250 }),
    weightKg: Number(body.weightKg),
    age: requireInt(body, "age", { min: 13, max: 100 }),
    gender: requireEnum(body, "gender", ["FEMALE", "MALE", "OTHER"] as const),
    activityLevel: requireEnum(body, "activityLevel", ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "ATHLETE"] as const),
    goal: requireEnum(body, "goal", ["FAT_LOSS", "MUSCLE_BUILD", "LIFESTYLE"] as const),
    dietaryStyle: dietaryStyleRaw as (typeof DIETARY_STYLES)[number] | undefined,
    dietaryPreferences: normalizeDietaryPreferences(optionalStringArray(body, "dietaryPreferences", DIETARY_PREFERENCES)),
    bodyFatPercent,
    gymTrainerId,
    goalTargetWeightKg,
    goalTimelineWeeks,
    goalTargetDate
  };
  if (!Number.isFinite(payload.weightKg) || payload.weightKg < 20 || payload.weightKg > 300) throw new HttpError(400, "Invalid weightKg");

  const result = await completeOnboarding(req.userId!, payload);
  return jsonOk(res, result);
}

const GOAL_PREVIEW_GOALS = ["FAT_LOSS", "MUSCLE_BUILD", "LIFESTYLE"] as const;

// Stateless preview — no DB read/write — so the onboarding wizard can show
// the safe-pace check and calorie/macro/hydration breakdown live, using
// values still sitting in the wizard's local state (nothing is persisted
// until the final /onboarding submit).
export async function postGoalPreview(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);

  const weightKg = Number(body.weightKg);
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) throw new HttpError(400, "Invalid weightKg");
  const heightCm = requireInt(body, "heightCm", { min: 50, max: 250 });
  const age = requireInt(body, "age", { min: 13, max: 100 });
  const gender = requireEnum(body, "gender", ["FEMALE", "MALE", "OTHER"] as const);
  const activityLevel = requireEnum(body, "activityLevel", ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "ATHLETE"] as const);
  const goal = requireEnum(body, "goal", GOAL_PREVIEW_GOALS) as GoalKind;

  let targetWeightKg: number | null = null;
  let timelineWeeks: number | null = null;
  if (goal !== "LIFESTYLE") {
    const rawTarget = optionalNumber(body, "targetWeightKg");
    if (rawTarget === undefined || rawTarget < 20 || rawTarget > 300) throw new HttpError(400, "Invalid targetWeightKg");
    targetWeightKg = rawTarget;
    const rawWeeks = optionalNumber(body, "timelineWeeks");
    if (rawWeeks === undefined || !Number.isInteger(rawWeeks) || rawWeeks < 1 || rawWeeks > 104) throw new HttpError(400, "Invalid timelineWeeks");
    timelineWeeks = rawWeeks;
  }

  const profile = { weightKg, heightCm, age, gender, activityLevel };
  const tdee = computeTDEE(profile);
  const pace = evaluateGoalPace({ goal, currentWeightKg: weightKg, targetWeightKg, timelineWeeks });
  const calorieTarget = computeGoalCalorieTarget({ tdee, goal, currentWeightKg: weightKg, targetWeightKg, timelineWeeks });
  const macros = computeMacroTargets({ dailyCalorieTarget: calorieTarget, goal, weightKg });
  const hydrationMl = computeHydrationTarget(weightKg);
  const weeklyProgress = targetWeightKg != null && timelineWeeks != null
    ? predictWeeklyProgress({ startWeightKg: weightKg, targetWeightKg, timelineWeeks })
    : null;

  return jsonOk(res, { tdee, pace, calorieTarget, macros, hydrationMl, weeklyProgress });
}

