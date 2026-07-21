import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { requireAdmin } from "../../shared/middleware/admin.middleware.js";
import { jsonError } from "../../shared/http/json-response.js";
import {
  postTrainerChangeRequest,
  getMyTrainerChangeRequestRoute,
  getTrainerChangeRequestsForAdmin,
  postReviewTrainerChangeRequest
} from "./trainer-change-requests.controller.js";

export const trainerChangeRequestsRouter = Router();

trainerChangeRequestsRouter.post("/trainer-change-requests", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postTrainerChangeRequest(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

trainerChangeRequestsRouter.get("/trainer-change-requests/me", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getMyTrainerChangeRequestRoute(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

trainerChangeRequestsRouter.get(
  "/admin/trainer-change-requests",
  requireUser,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    try {
      await getTrainerChangeRequestsForAdmin(req, res);
      return;
    } catch (err) {
      return jsonError(res, err);
    }
  }
);

trainerChangeRequestsRouter.post(
  "/admin/trainer-change-requests/:id/review",
  requireUser,
  requireAdmin,
  async (req: AuthedRequest, res) => {
    try {
      await postReviewTrainerChangeRequest(req, res);
      return;
    } catch (err) {
      return jsonError(res, err);
    }
  }
);
