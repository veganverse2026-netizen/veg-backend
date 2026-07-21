import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import {
  getPersonalRecordsPaginated,
  getWeeklyVolumeHandler,
  getWorkoutCompletionToday,
  getWorkoutLogs,
  postWorkoutLog,
  postWorkoutLogSession,
  postWorkoutMarkDone
} from "./workout-logs.controller.js";

export const workoutLogsRouter = Router();

workoutLogsRouter.get("/workout-logs", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getWorkoutLogs(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

workoutLogsRouter.get("/workout-logs/prs", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getPersonalRecordsPaginated(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

workoutLogsRouter.get("/workout-logs/completion", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getWorkoutCompletionToday(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

workoutLogsRouter.get("/workout-logs/weekly-volume", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getWeeklyVolumeHandler(req, res);
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

workoutLogsRouter.post("/workout-logs/log-session", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postWorkoutLogSession(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

workoutLogsRouter.post("/workout-logs/mark-done", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postWorkoutMarkDone(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
