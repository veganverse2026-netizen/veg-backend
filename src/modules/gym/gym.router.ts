import { Router } from "express";
import { requireUser, optionalUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError } from "../../shared/http/json-response.js";
import {
  getGymTrainers,
  postPlanChangeRequest,
  getMyPlanRequest,
  getTrainerPlanQueue,
  postReviewPlanRequest,
  getGymProgressPhotos,
  postGymProgressPhoto,
  postMissedWorkout
} from "./gym.controller.js";

export const gymRouter = Router();

gymRouter.get("/gym/trainers", optionalUser, async (req: AuthedRequest, res) => {
  try {
    await getGymTrainers(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.post("/gym/plan-requests", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postPlanChangeRequest(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.get("/gym/plan-requests/me", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getMyPlanRequest(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.get("/gym/plan-requests/trainer-queue", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getTrainerPlanQueue(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.post("/gym/plan-requests/review", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postReviewPlanRequest(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.get("/gym/progress-photos", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getGymProgressPhotos(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.post("/gym/progress-photos", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postGymProgressPhoto(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.post("/gym/missed-workout", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postMissedWorkout(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
