import { Router } from "express";
import { requireUser, optionalUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { requireRole } from "../../shared/middleware/role.middleware.js";
import { jsonError } from "../../shared/http/json-response.js";
import {
  getGymTrainers,
  postPlanChangeRequest,
  getMyPlanRequest,
  getTrainerPlanQueue,
  postReviewPlanRequest,
  getMyMembers,
  getMemberDetail,
  postAssignInitialPlan,
  getMyTrainerProfileHandler,
  patchMyTrainerProfile,
  getGymProgressPhotos,
  postGymProgressPhoto,
  postMissedWorkout
} from "./gym.controller.js";

const requireTrainer = requireRole("GYM_TRAINER");

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

gymRouter.get("/gym/plan-requests/trainer-queue", requireUser, requireTrainer, async (req: AuthedRequest, res) => {
  try {
    await getTrainerPlanQueue(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.post("/gym/plan-requests/review", requireUser, requireTrainer, async (req: AuthedRequest, res) => {
  try {
    await postReviewPlanRequest(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.post("/gym/plan-requests/assign", requireUser, requireTrainer, async (req: AuthedRequest, res) => {
  try {
    await postAssignInitialPlan(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.get("/gym/my-members", requireUser, requireTrainer, async (req: AuthedRequest, res) => {
  try {
    await getMyMembers(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.get("/gym/my-members/:id", requireUser, requireTrainer, async (req: AuthedRequest, res) => {
  try {
    await getMemberDetail(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.get("/gym/trainer-profile", requireUser, requireTrainer, async (req: AuthedRequest, res) => {
  try {
    await getMyTrainerProfileHandler(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

gymRouter.patch("/gym/trainer-profile", requireUser, requireTrainer, async (req: AuthedRequest, res) => {
  try {
    await patchMyTrainerProfile(req, res);
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
