import { Router } from "express";
import { jsonError } from "../../shared/http/json-response.js";
import { requireAdmin } from "../../shared/middleware/admin.middleware.js";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import {
  deleteGymTrainer,
  getGymTrainerDetail,
  getGymTrainers,
  getOverview,
  getPlanRequestById,
  getPlanRequests,
  getUserGymPlan,
  getUsers,
  patchGymTrainer,
  patchPlanRequestSessions,
  patchUserGymPlan,
  patchUserGymTrainer,
  patchUserRole,
  postGymTrainer,
  postUserGymPlanRows
} from "./admin.controller.js";
import { getAdminRecipes, postAdminRecipe, patchAdminRecipe, deleteAdminRecipe } from "./admin-recipes.controller.js";
import { adminGetPosts, adminDeletePost, adminGetReports, adminResolveReport } from "./admin-community.controller.js";
import { getAdminWorkouts, postAdminWorkout, patchAdminWorkout, deleteAdminWorkout } from "./admin-workouts.controller.js";

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

adminRouter.patch("/admin/users/:id/gym-trainer", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await patchUserGymTrainer(req, res);
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

adminRouter.get("/admin/gym-trainers/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try {
    await getGymTrainerDetail(req, res);
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

// ─── Recipes ─────────────────────────────────────────────────────────────────
adminRouter.get("/admin/recipes", requireAdmin, async (req: AuthedRequest, res) => {
  try { await getAdminRecipes(req, res); } catch (err) { return jsonError(res, err); }
});
adminRouter.post("/admin/recipes", requireAdmin, async (req: AuthedRequest, res) => {
  try { await postAdminRecipe(req, res); } catch (err) { return jsonError(res, err); }
});
adminRouter.patch("/admin/recipes/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try { await patchAdminRecipe(req, res); } catch (err) { return jsonError(res, err); }
});
adminRouter.delete("/admin/recipes/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try { await deleteAdminRecipe(req, res); } catch (err) { return jsonError(res, err); }
});

// ─── Workouts ─────────────────────────────────────────────────────────────────
adminRouter.get("/admin/workouts", requireAdmin, async (req: AuthedRequest, res) => {
  try { await getAdminWorkouts(req, res); } catch (err) { return jsonError(res, err); }
});
adminRouter.post("/admin/workouts", requireAdmin, async (req: AuthedRequest, res) => {
  try { await postAdminWorkout(req, res); } catch (err) { return jsonError(res, err); }
});
adminRouter.patch("/admin/workouts/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try { await patchAdminWorkout(req, res); } catch (err) { return jsonError(res, err); }
});
adminRouter.delete("/admin/workouts/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try { await deleteAdminWorkout(req, res); } catch (err) { return jsonError(res, err); }
});

// ─── Community moderation ─────────────────────────────────────────────────────
adminRouter.get("/admin/posts", requireAdmin, async (req: AuthedRequest, res) => {
  try { await adminGetPosts(req, res); } catch (err) { return jsonError(res, err); }
});
adminRouter.delete("/admin/posts/:id", requireAdmin, async (req: AuthedRequest, res) => {
  try { await adminDeletePost(req, res); } catch (err) { return jsonError(res, err); }
});
adminRouter.get("/admin/reports", requireAdmin, async (req: AuthedRequest, res) => {
  try { await adminGetReports(req, res); } catch (err) { return jsonError(res, err); }
});
adminRouter.patch("/admin/reports/:id/resolve", requireAdmin, async (req: AuthedRequest, res) => {
  try { await adminResolveReport(req, res); } catch (err) { return jsonError(res, err); }
});
