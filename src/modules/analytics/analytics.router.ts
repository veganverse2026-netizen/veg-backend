import { Router } from "express";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireUser } from "../../shared/middleware/auth.middleware.js";
import { requireAdmin } from "../../shared/middleware/admin.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { getSalesAnalytics } from "./analytics.service.js";

export const analyticsRouter = Router();

analyticsRouter.get("/admin/analytics/sales", requireUser, requireAdmin, asyncHandler(async (req, res) => {
  const raw = (req.query as any)?.days;
  const days = Number.isFinite(Number(raw)) ? Math.max(1, Math.min(365, Number(raw))) : 30;
  return jsonOk(res, await getSalesAnalytics(days));
}));
