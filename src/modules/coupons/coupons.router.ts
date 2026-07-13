import { Router } from "express";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireUser } from "../../shared/middleware/auth.middleware.js";
import { requireAdmin } from "../../shared/middleware/admin.middleware.js";
import { getCoupons, patchCoupon, postCoupon, postValidateCoupon, removeCoupon } from "./coupons.controller.js";

export const couponsRouter = Router();

couponsRouter.post("/coupons/validate", requireUser, asyncHandler(postValidateCoupon));

couponsRouter.get("/admin/coupons", requireUser, requireAdmin, asyncHandler(getCoupons));
couponsRouter.post("/admin/coupons", requireUser, requireAdmin, asyncHandler(postCoupon));
couponsRouter.patch("/admin/coupons/:id", requireUser, requireAdmin, asyncHandler(patchCoupon));
couponsRouter.delete("/admin/coupons/:id", requireUser, requireAdmin, asyncHandler(removeCoupon));
