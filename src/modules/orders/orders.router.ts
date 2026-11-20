import crypto from "crypto";
import { Router } from "express";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { requireAdmin } from "../../shared/middleware/admin.middleware.js";
import {
  adminGetOrder,
  adminListOrders,
  adminUpdateOrderStatus,
  cancelMyOrder,
  createOrderFromStripe,
  getMyOrder,
  listMyOrders,
} from "./orders.service.js";

export const ordersRouter = Router();

// ─── User: my orders ─────────────────────────────────────────────────────────
ordersRouter.get("/orders/me", requireUser, async (req: AuthedRequest, res) => {
  try {
    const result = await listMyOrders(req.userId!);
    return jsonOk(res, result);
  } catch (err) {
    return jsonError(res, err);
  }
});

ordersRouter.get("/orders/me/:id", requireUser, async (req: AuthedRequest, res) => {
  try {
    const result = await getMyOrder(req.userId!, req.params.id);
    return jsonOk(res, result);
  } catch (err) {
    return jsonError(res, err);
  }
});

ordersRouter.post("/orders/me/:id/cancel", requireUser, async (req: AuthedRequest, res) => {
  try {
    const reason = typeof (req.body as any)?.reason === "string" ? (req.body as any).reason.slice(0, 500) : undefined;
    const result = await cancelMyOrder(req.userId!, req.params.id, reason);
    return jsonOk(res, result);
  } catch (err) {
    return jsonError(res, err);
  }
});

// Constant-time compare; rejects outright if INTERNAL_SECRET is unset/empty.
function isValidInternalSecret(provided: string | undefined): boolean {
  const expected = process.env.INTERNAL_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Internal: create order from Stripe (called from Next.js webhook) ────────
ordersRouter.post("/orders/internal/from-stripe", async (req, res) => {
  try {
    if (!isValidInternalSecret(req.header("x-internal-secret"))) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const body = req.body as {
      userId: string;
      stripeSessionId: string;
      stripePaymentId?: string;
      items: Array<{ productId: string; quantity: number }>;
      tax?: number;
      shipping?: number;
      addressId?: string;
      couponCode?: string;
    };
    const result = await createOrderFromStripe(body);
    return res.json({ ok: true, data: result });
  } catch (err) {
    return jsonError(res, err);
  }
});

// ─── Admin: all orders ────────────────────────────────────────────────────────
ordersRouter.get("/admin/orders", requireUser, requireAdmin, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = (parseInt(String(req.query.page ?? ""), 10) || 1);
    const limit = (parseInt(String(req.query.limit ?? ""), 10) || 20);
    const result = await adminListOrders({ status, page, limit });
    return jsonOk(res, result);
  } catch (err) {
    return jsonError(res, err);
  }
});

ordersRouter.get("/admin/orders/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const result = await adminGetOrder(req.params.id);
    return jsonOk(res, result);
  } catch (err) {
    return jsonError(res, err);
  }
});

ordersRouter.patch("/admin/orders/:id/status", requireUser, requireAdmin, async (req, res) => {
  try {
    const { status, reason } = req.body as { status: string; reason?: string };
    if (!status) return jsonError(res, new Error("status required"));
    const result = await adminUpdateOrderStatus(req.params.id, status, reason);
    return jsonOk(res, result);
  } catch (err) {
    return jsonError(res, err);
  }
});
