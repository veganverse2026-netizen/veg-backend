import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import {
  optionalNumber, optionalString, requireEnum, requireInt, requireObject, requireString
} from "../../shared/validation/validators.js";
import { createCoupon, deleteCoupon, listCoupons, updateCoupon, validateCoupon } from "./coupons.service.js";

export async function postValidateCoupon(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const code = requireString(body, "code", { trim: true, min: 1, max: 40 });
  const subtotal = optionalNumber(body, "subtotal") ?? 0;
  if (subtotal <= 0) throw new HttpError(400, "Cart is empty");
  return jsonOk(res, await validateCoupon(code, subtotal));
}

export async function getCoupons(req: AuthedRequest, res: Response) {
  const q = req.query as any;
  const page = q.page ? Number(q.page) : undefined;
  const limit = q.limit ? Number(q.limit) : undefined;
  return jsonOk(res, await listCoupons({ page, limit }));
}

function readCouponBody(body: Record<string, any>, partial: boolean) {
  const code = partial ? optionalString(body, "code", { trim: true, max: 40 }) : requireString(body, "code", { trim: true, min: 1, max: 40 });
  let type: "PERCENT" | "FIXED" | undefined;
  if (body.type !== undefined) type = requireEnum(body, "type", ["PERCENT", "FIXED"] as const);
  else if (!partial) throw new HttpError(400, "type is required");
  const value = optionalNumber(body, "value");
  if (!partial && value == null) throw new HttpError(400, "value is required");
  if (value != null && value <= 0) throw new HttpError(400, "value must be positive");

  const minOrderValue = body.minOrderValue === null ? null : optionalNumber(body, "minOrderValue");
  const maxDiscount = body.maxDiscount === null ? null : optionalNumber(body, "maxDiscount");
  const usageLimit = body.usageLimit === null ? null : (body.usageLimit !== undefined ? requireInt(body, "usageLimit", { min: 1 }) : undefined);
  const startsAt = body.startsAt === null ? null : optionalString(body, "startsAt");
  const expiresAt = body.expiresAt === null ? null : optionalString(body, "expiresAt");
  const active = body.active === undefined ? undefined : Boolean(body.active);

  return { code, type, value, minOrderValue, maxDiscount, usageLimit, startsAt, expiresAt, active };
}

export async function postCoupon(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const input = readCouponBody(body, false);
  return jsonOk(res, await createCoupon(input as any), 201);
}

export async function patchCoupon(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const input = readCouponBody(body, true);
  return jsonOk(res, await updateCoupon(req.params.id, input as any));
}

export async function removeCoupon(req: AuthedRequest, res: Response) {
  return jsonOk(res, await deleteCoupon(req.params.id));
}
