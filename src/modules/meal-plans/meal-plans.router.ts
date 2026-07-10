import { Router } from "express";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireUser } from "../../shared/middleware/auth.middleware.js";
import { requireRole } from "../../shared/middleware/role.middleware.js";
import {
  deleteFavorite,
  deleteLog,
  getFavorites,
  getLogs,
  getMemberPlanForTrainer,
  getMealLibrary,
  getMinePlan,
  getMyRequest,
  getNutrients,
  getRecommendationsHandler,
  getSummary,
  getTrainerQueue,
  postFavorite,
  postLog,
  postRegenerationRequest,
  postSelectPlan,
  postStartReview,
  postTrainerAssign,
  postTrainerReview,
  postUpdatePlan
} from "./meal-plans.controller.js";

const requireTrainer = requireRole("GYM_TRAINER");

export const mealPlansRouter = Router();

/* member */
mealPlansRouter.get("/meal-plans/recommendations", requireUser, asyncHandler(getRecommendationsHandler));
mealPlansRouter.get("/meal-plans/mine", requireUser, asyncHandler(getMinePlan));
mealPlansRouter.get("/meal-plans/nutrients", requireUser, asyncHandler(getNutrients));
mealPlansRouter.post("/meal-plans/select", requireUser, asyncHandler(postSelectPlan));
mealPlansRouter.post("/meal-plans/update", requireUser, asyncHandler(postUpdatePlan));
mealPlansRouter.get("/meal-plans/requests/me", requireUser, asyncHandler(getMyRequest));
mealPlansRouter.post("/meal-plans/requests", requireUser, asyncHandler(postRegenerationRequest));

/* trainer */
mealPlansRouter.get("/meal-plans/requests/trainer-queue", requireUser, requireTrainer, asyncHandler(getTrainerQueue));
mealPlansRouter.post("/meal-plans/requests/review", requireUser, requireTrainer, asyncHandler(postTrainerReview));
mealPlansRouter.post("/meal-plans/requests/:id/start-review", requireUser, requireTrainer, asyncHandler(postStartReview));
mealPlansRouter.get("/meal-plans/library", requireUser, requireTrainer, asyncHandler(getMealLibrary));
mealPlansRouter.post("/meal-plans/assign", requireUser, requireTrainer, asyncHandler(postTrainerAssign));
mealPlansRouter.get("/meal-plans/member/:id", requireUser, requireTrainer, asyncHandler(getMemberPlanForTrainer));

/* favorites */
mealPlansRouter.get("/meal-plans/favorites", requireUser, asyncHandler(getFavorites));
mealPlansRouter.post("/meal-plans/favorites", requireUser, asyncHandler(postFavorite));
mealPlansRouter.delete("/meal-plans/favorites/:id", requireUser, asyncHandler(deleteFavorite));

/* food logging + daily summary */
mealPlansRouter.get("/meal-logs", requireUser, asyncHandler(getLogs));
mealPlansRouter.post("/meal-logs", requireUser, asyncHandler(postLog));
mealPlansRouter.delete("/meal-logs/:id", requireUser, asyncHandler(deleteLog));
mealPlansRouter.get("/meal-logs/summary", requireUser, asyncHandler(getSummary));
