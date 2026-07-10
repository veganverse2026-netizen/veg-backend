import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { optionalNumber, optionalString, optionalStringArray, requireEnum, requireInt, requireObject } from "../../shared/validation/validators.js";
import { DIETARY_PREFERENCES, DIETARY_STYLES } from "../../shared/constants/dietary.js";
import { completeOnboarding } from "./onboarding.service.js";
export async function postOnboarding(req, res) {
    const body = requireObject(req.body);
    let gymTrainerId;
    if (body.gymTrainerId === null) {
        gymTrainerId = null;
    }
    else if (body.gymTrainerId !== undefined) {
        const gymTrainerRaw = optionalString(body, "gymTrainerId", { trim: true, max: 40 });
        gymTrainerId = gymTrainerRaw === undefined ? undefined : gymTrainerRaw.length === 0 ? null : gymTrainerRaw;
    }
    const dietaryStyleRaw = optionalString(body, "dietaryStyle", { trim: true, max: 40 });
    if (dietaryStyleRaw !== undefined && !DIETARY_STYLES.includes(dietaryStyleRaw)) {
        throw new HttpError(400, "Invalid dietaryStyle");
    }
    const bodyFatPercent = optionalNumber(body, "bodyFatPercent");
    if (bodyFatPercent !== undefined && (bodyFatPercent < 3 || bodyFatPercent > 60)) {
        throw new HttpError(400, "Invalid bodyFatPercent");
    }
    const payload = {
        heightCm: requireInt(body, "heightCm", { min: 100, max: 260 }),
        weightKg: Number(body.weightKg),
        age: requireInt(body, "age", { min: 12, max: 100 }),
        gender: requireEnum(body, "gender", ["FEMALE", "MALE", "OTHER"]),
        activityLevel: requireEnum(body, "activityLevel", ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "ATHLETE"]),
        goal: requireEnum(body, "goal", ["FAT_LOSS", "MUSCLE_BUILD", "LIFESTYLE"]),
        dietaryStyle: dietaryStyleRaw,
        dietaryPreferences: optionalStringArray(body, "dietaryPreferences", DIETARY_PREFERENCES),
        bodyFatPercent,
        gymTrainerId
    };
    if (!Number.isFinite(payload.weightKg) || payload.weightKg < 30 || payload.weightKg > 300)
        throw new HttpError(400, "Invalid weightKg");
    const result = await completeOnboarding(req.userId, payload);
    return jsonOk(res, result);
}
