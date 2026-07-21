import { jsonOk } from "../../shared/http/json-response.js";
import { optionalBoolean, optionalNumber, requireObject } from "../../shared/validation/validators.js";
import { addTrackerEntry, listTrackers, listTrackerHistoryPaginated } from "./tracker.service.js";
export async function getTracker(req, res) {
    const trackers = await listTrackers(req.userId);
    return jsonOk(res, trackers);
}
export async function getTrackerHistoryPaginated(req, res) {
    const page = req.query.page ? parseInt(req.query.page) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10;
    const result = await listTrackerHistoryPaginated(req.userId, page, limit);
    return jsonOk(res, result);
}
export async function postTracker(req, res) {
    const body = requireObject(req.body);
    const payload = {
        weightKg: optionalNumber(body, "weightKg"),
        caloriesConsumed: optionalNumber(body, "caloriesConsumed"),
        proteinIntake: optionalNumber(body, "proteinIntake"),
        workoutCompleted: optionalBoolean(body, "workoutCompleted"),
        hydrationMl: optionalNumber(body, "hydrationMl"),
        sleepHours: optionalNumber(body, "sleepHours"),
        bodyFatPercent: optionalNumber(body, "bodyFatPercent")
    };
    const result = await addTrackerEntry(req.userId, payload);
    return jsonOk(res, result);
}
