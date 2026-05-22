import { Router } from "express";
import { jsonError } from "../../shared/http/json-response.js";
import { requireAdmin } from "../../shared/middleware/admin.middleware.js";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import {
  deleteGymTrainer,
  getGymTrainers,
  getOverview,
  getPlanRequestById,
  getPlanRequests,
  getUserGymPlan,
  getUsers,
  patchGymTrainer,
  patchPlanRequestSessions,
  patchUserGymPlan,
  patchUserRole,
  postGymTrainer,
  postUserGymPlanRows
} from "./admin.controller.js";

export const adminRouter = Router();

adminRouter.get("/admin/overview", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await getOverview(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.get("/admin/users", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await getUsers(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.patch("/admin/users/:id/role", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await patchUserRole(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.get("/admin/gym-trainers", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await getGymTrainers(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.post("/admin/gym-trainers", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await postGymTrainer(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.patch("/admin/gym-trainers/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await patchGymTrainer(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.delete("/admin/gym-trainers/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await deleteGymTrainer(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.get("/admin/plan-requests", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await getPlanRequests(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.get("/admin/plan-requests/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await getPlanRequestById(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.patch("/admin/plan-requests/:id/sessions", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await patchPlanRequestSessions(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.get("/admin/users/:id/gym-plan", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await getUserGymPlan(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.post("/admin/users/:id/gym-plan", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await postUserGymPlanRows(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

adminRouter.patch("/admin/users/:id/gym-plan", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await patchUserGymPlan(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});
