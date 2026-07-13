import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { Coupon } from "@prisma/client";

export function computeCouponDiscount(coupon: Coupon, subtotal: number): number {
  const raw = coupon.type === "PERCENT" ? subtotal * (coupon.value / 100) : coupon.value;
  const capped = coupon.maxDiscount != null ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.min(Math.max(0, capped), subtotal);
}

export async function validateCoupon(code: string, subtotal: number) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) throw new HttpError(404, "Coupon code not found");
  if (!coupon.active) throw new HttpError(400, "This coupon is no longer active");

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) throw new HttpError(400, "This coupon isn't active yet");
  if (coupon.expiresAt && now > coupon.expiresAt) throw new HttpError(400, "This coupon has expired");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    throw new HttpError(400, "This coupon has reached its usage limit");
  }
  if (coupon.minOrderValue != null && subtotal < coupon.minOrderValue) {
    throw new HttpError(400, `Minimum order value for this coupon is ₹${coupon.minOrderValue}`);
  }

  const discount = computeCouponDiscount(coupon, subtotal);
  return {
    valid: true,
    discount,
    coupon: { code: coupon.code, type: coupon.type, value: coupon.value }
  };
}

/**
 * Best-effort reservation used at order-creation time (after payment has
 * already succeeded) — never throws, since a coupon race here shouldn't
 * unwind a completed payment. Returns the discount actually recorded (0 if
 * the coupon became invalid between checkout and webhook).
 */
export async function reserveCouponUsage(code: string, subtotal: number): Promise<number> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon || !coupon.active) return 0;

  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) return 0;
  if (coupon.expiresAt && now > coupon.expiresAt) return 0;
  if (coupon.minOrderValue != null && subtotal < coupon.minOrderValue) return 0;

  const reserved = await prisma.coupon.updateMany({
    where: {
      id: coupon.id,
      OR: [{ usageLimit: null }, { usedCount: { lt: coupon.usageLimit ?? 0 } }]
    },
    data: { usedCount: { increment: 1 } }
  });
  if (reserved.count === 0) return 0;

  return computeCouponDiscount(coupon, subtotal);
}

export async function listCoupons(opts: { page?: number; limit?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, opts.limit ?? 20);
  const [total, coupons] = await Promise.all([
    prisma.coupon.count(),
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit })
  ]);
  return { coupons, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function createCoupon(input: {
  code: string; type: "PERCENT" | "FIXED"; value: number;
  minOrderValue?: number | null; maxDiscount?: number | null;
  usageLimit?: number | null; startsAt?: string | null; expiresAt?: string | null; active?: boolean;
}) {
  try {
    return await prisma.coupon.create({
      data: {
        code: input.code.trim().toUpperCase(),
        type: input.type,
        value: input.value,
        minOrderValue: input.minOrderValue ?? null,
        maxDiscount: input.maxDiscount ?? null,
        usageLimit: input.usageLimit ?? null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        active: input.active ?? true
      }
    });
  } catch (err: any) {
    if (err?.code === "P2002") throw new HttpError(400, "A coupon with this code already exists");
    throw err;
  }
}

export async function updateCoupon(id: string, input: Partial<{
  code: string; type: "PERCENT" | "FIXED"; value: number;
  minOrderValue: number | null; maxDiscount: number | null;
  usageLimit: number | null; startsAt: string | null; expiresAt: string | null; active: boolean;
}>) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Coupon not found");

  try {
    return await prisma.coupon.update({
      where: { id },
      data: {
        code: input.code !== undefined ? input.code.trim().toUpperCase() : undefined,
        type: input.type,
        value: input.value,
        minOrderValue: input.minOrderValue,
        maxDiscount: input.maxDiscount,
        usageLimit: input.usageLimit,
        startsAt: input.startsAt !== undefined ? (input.startsAt ? new Date(input.startsAt) : null) : undefined,
        expiresAt: input.expiresAt !== undefined ? (input.expiresAt ? new Date(input.expiresAt) : null) : undefined,
        active: input.active
      }
    });
  } catch (err: any) {
    if (err?.code === "P2002") throw new HttpError(400, "A coupon with this code already exists");
    throw err;
  }
}

export async function deleteCoupon(id: string) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Coupon not found");
  await prisma.coupon.delete({ where: { id } });
  return { ok: true };
}
