import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { jsonOk } from "../../shared/http/json-response.js";
import {
  listMyNotifications,
  markNotificationRead,
  markAllRead,
  broadcastNotification,
  adminListNotifications,
  deleteNotification,
  getUnreadCount,
} from "./notifications.service.js";

const VALID_TYPES = ["ORDER_UPDATE", "COMMUNITY", "GYM", "MEAL", "SYSTEM"] as const;

export async function getMyNotifications(req: AuthedRequest, res: Response) {
  const unreadOnly = req.query.unreadOnly === "true";
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const data = await listMyNotifications(req.userId!, { limit, unreadOnly });
  return jsonOk(res, data);
}

export async function getUnread(req: AuthedRequest, res: Response) {
  const data = await getUnreadCount(req.userId!);
  return jsonOk(res, data);
}

export async function patchRead(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!id) throw new HttpError(400, "id required");
  const data = await markNotificationRead(req.userId!, id);
  return jsonOk(res, data ?? { ok: false, message: "Not found" });
}

export async function patchAllRead(req: AuthedRequest, res: Response) {
  const data = await markAllRead(req.userId!);
  return jsonOk(res, data);
}

export async function adminBroadcast(req: AuthedRequest, res: Response) {
  const { type, title, body, link, roleFilter } = req.body as Record<string, string>;
  if (!title?.trim()) throw new HttpError(400, "title required");
  if (!body?.trim()) throw new HttpError(400, "body required");
  const t = (type ?? "SYSTEM").trim().toUpperCase();
  if (!VALID_TYPES.includes(t as any)) throw new HttpError(400, "Invalid type");
  const data = await broadcastNotification({
    type: t as any,
    title: title.trim(),
    body: body.trim(),
    link: link?.trim() || undefined,
    roleFilter: roleFilter?.trim() || undefined,
  });
  return jsonOk(res, data);
}

export async function adminGetNotifications(req: AuthedRequest, res: Response) {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const data = await adminListNotifications({ page, limit });
  return jsonOk(res, data);
}

export async function adminDeleteNotification(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!id) throw new HttpError(400, "id required");
  const data = await deleteNotification(id);
  return jsonOk(res, data);
}
