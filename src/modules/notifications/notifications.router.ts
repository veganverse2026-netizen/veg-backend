import { Router } from "express";
import { requireUser } from "../../shared/middleware/auth.middleware.js";
import { requireAdmin } from "../../shared/middleware/admin.middleware.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { jsonError } from "../../shared/http/json-response.js";
import {
  getMyNotifications,
  getUnread,
  patchRead,
  patchAllRead,
  deleteMyNotificationRoute,
  adminBroadcast,
  adminGetNotifications,
  adminDeleteNotification,
} from "./notifications.controller.js";

export const notificationsRouter = Router();

// User routes
notificationsRouter.get("/notifications", requireUser, asyncHandler(getMyNotifications));
notificationsRouter.get("/notifications/unread-count", requireUser, asyncHandler(getUnread));
notificationsRouter.patch("/notifications/read-all", requireUser, asyncHandler(patchAllRead));
notificationsRouter.patch("/notifications/:id/read", requireUser, asyncHandler(patchRead));
notificationsRouter.delete("/notifications/:id", requireUser, asyncHandler(deleteMyNotificationRoute));

// Admin routes
notificationsRouter.get("/admin/notifications", requireUser, requireAdmin, asyncHandler(adminGetNotifications));
notificationsRouter.post("/admin/notifications/broadcast", requireUser, requireAdmin, asyncHandler(adminBroadcast));
notificationsRouter.delete("/admin/notifications/:id", requireUser, requireAdmin, asyncHandler(adminDeleteNotification));
