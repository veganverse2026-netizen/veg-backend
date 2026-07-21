import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { optionalIsoDateTimeString, optionalNumber, optionalString, requireInt, requireObject, requireString } from "../../shared/validation/validators.js";
import { createWorkoutLog, getTodayWorkoutCompletion, getWeeklyVolume, listPersonalRecordsPaginated, listWorkoutLogsWithPrs, logWorkoutSession, markWorkoutDone } from "./workout-logs.service.js";
export async function getWorkoutLogs(req, res) {
    const result = await listWorkoutLogsWithPrs(req.userId);
    return jsonOk(res, result);
}
export async function getPersonalRecordsPaginated(req, res) {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const result = await listPersonalRecordsPaginated(req.userId, page, limit, q);
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
export async function getWorkoutCompletionToday(req, res) {
    const result = await getTodayWorkoutCompletion(req.userId);
    return jsonOk(res, result);
}
export async function postWorkoutLogSession(req, res) {
    const body = requireObject(req.body);
    const rawExercises = body.exercises;
    if (!Array.isArray(rawExercises) || rawExercises.length === 0) {
        throw new HttpError(400, "exercises must be a non-empty array");
    }
    const exercises = rawExercises.map((raw, i) => {
        const item = requireObject(raw, `Invalid exercise at index ${i}`);
        const weightKg = optionalNumber(item, "weightKg") ?? 0;
        if (weightKg < 0 || weightKg > 1000)
            throw new HttpError(400, `Invalid weightKg at index ${i}`);
        return {
            exercise: requireString(item, "exercise", { trim: true, min: 2, max: 120 }),
            sets: requireInt(item, "sets", { min: 1, max: 20 }),
            reps: requireInt(item, "reps", { min: 1, max: 200 }),
            weightKg,
            notes: optionalString(item, "notes", { max: 500, trim: true }) ?? null
        };
    });
    const result = await logWorkoutSession(req.userId, exercises);
    return jsonOk(res, result, 201);
}
export async function postWorkoutMarkDone(req, res) {
    const result = await markWorkoutDone(req.userId);
    return jsonOk(res, result, 201);
}
export async function getWeeklyVolumeHandler(req, res) {
    const result = await getWeeklyVolume(req.userId);
    return jsonOk(res, result);
}
