import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { optionalIsoDateTimeString, optionalNumber, optionalString, requireInt, requireObject, requireString } from "../../shared/validation/validators.js";
import { createWorkoutLog, listWorkoutLogsWithPrs } from "./workout-logs.service.js";
export async function getWorkoutLogs(req, res) {
    const result = await listWorkoutLogsWithPrs(req.userId);
    return jsonOk(res, result);
}
export async function postWorkoutLog(req, res) {
    const body = requireObject(req.body);
    const payload = {
        exercise: requireString(body, "exercise", { trim: true, min: 2, max: 120 }),
        sets: requireInt(body, "sets", { min: 1, max: 20 }),
        reps: requireInt(body, "reps", { min: 1, max: 200 }),
        weightKg: optionalNumber(body, "weightKg"),
        notes: optionalString(body, "notes", { max: 500, trim: true }),
        performedAt: optionalIsoDateTimeString(body, "performedAt")
    };
    if (payload.weightKg == null || payload.weightKg < 0 || payload.weightKg > 1000)
        throw new HttpError(400, "Invalid weightKg");
    const performedAt = payload.performedAt ? new Date(payload.performedAt) : new Date();
    const result = await createWorkoutLog(req.userId, {
        performedAt,
        exercise: payload.exercise,
        sets: payload.sets,
        reps: payload.reps,
        weightKg: payload.weightKg,
        notes: payload.notes ?? null
    });
    return jsonOk(res, result, 201);
}
