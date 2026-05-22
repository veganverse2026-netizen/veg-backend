import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { getWorkoutLogs, postWorkoutLog } from "./workout-logs.controller.js";

export const workoutLogsRouter = Router();

workoutLogsRouter.get("/workout-logs", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getWorkoutLogs(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

workoutLogsRouter.post("/workout-logs", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postWorkoutLog(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
