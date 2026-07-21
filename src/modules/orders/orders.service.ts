import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { createNotification } from "../notifications/notifications.service.js";
import { computeCouponDiscount } from "../coupons/coupons.service.js";

const ORDER_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;
const USER_CANCELLABLE_STATUSES = ["PENDING", "PAID", "PROCESSING"] as const;
const TERMINAL_STOCK_STATUSES = ["CANCELLED", "REFUNDED"] as const;

const PRODUCT_SELECT = { id: true, name: true, slug: true, imageUrls: true, price: true, stock: true, status: true } as const;

export async function listMyOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { product: { select: PRODUCT_SELECT } } },
      address: true,
    },
  });
}

export async function getMyOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: { include: { product: { select: PRODUCT_SELECT } } },
      address: true,
    },
  });
  if (!order) throw new HttpError(404, "Order not found");
  return order;
}

export async function createOrderFromStripe(input: {
  userId: string;
  stripeSessionId: string;
  stripePaymentId?: string;
  items: Array<{ productId: string; quantity: number }>;
  tax?: number;
  shipping?: number;
  addressId?: string;
  couponCode?: string;
}) {
  const existing = await prisma.order.findUnique({ where: { stripeSessionId: input.stripeSessionId } });
  if (existing) return existing;

  // Defense-in-depth: never trust client/webhook-supplied prices or stock levels.
  // Re-derive unit prices and the product snapshot straight from the catalog and
  // atomically guard stock so a tampered checkout payload or a race between two
  // buyers can't oversell or under-charge.
  return prisma.$transaction(async (tx) => {
    let subtotal = 0;
    const itemsData: Array<{ productId: string; quantity: number; unitPrice: number; total: number; productSnap: object }> = [];

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new HttpError(400, `Invalid quantity for product ${item.productId}`);
      }
      const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true, slug: true, price: true } });
      if (!product) throw new HttpError(400, `Unknown product ${item.productId}`);

      const decremented = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (decremented.count === 0) throw new HttpError(409, `Insufficient stock for product ${item.productId}`);

      const lineTotal = item.quantity * product.price;
      subtotal += lineTotal;
      itemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.price,
        total: lineTotal,
        productSnap: { name: product.name, slug: product.slug, price: product.price },
      });
    }

    const tax = input.tax ?? 0;
    const shipping = input.shipping ?? 0;

    // Coupon usage is reserved here, inside the same transaction as the stock
    // decrement, so a concurrent order can't both succeed against a
    // single-use coupon. Payment has already succeeded by this point (this
    // runs from the Stripe webhook), so an expired/exhausted coupon just
    // means the order records zero discount rather than failing the order.
    let discount = 0;
    if (input.couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: input.couponCode.trim().toUpperCase() } });
      if (coupon && coupon.active) {
        const now = new Date();
        const withinWindow = (!coupon.startsAt || now >= coupon.startsAt) && (!coupon.expiresAt || now <= coupon.expiresAt);
        const meetsMinimum = coupon.minOrderValue == null || subtotal >= coupon.minOrderValue;
        if (withinWindow && meetsMinimum) {
          const reserved = await tx.coupon.updateMany({
            where: { id: coupon.id, OR: [{ usageLimit: null }, { usedCount: { lt: coupon.usageLimit ?? 0 } }] },
            data: { usedCount: { increment: 1 } },
          });
          if (reserved.count > 0) discount = computeCouponDiscount(coupon, subtotal);
        }
      }
    }

    const total = Math.max(0, subtotal + tax + shipping - discount);

    return tx.order.create({
      data: {
        userId: input.userId,
        stripeSessionId: input.stripeSessionId,
        stripePaymentId: input.stripePaymentId ?? null,
        status: "PAID",
        subtotal,
        tax,
        shipping,
        discount,
        couponCode: discount > 0 ? input.couponCode!.trim().toUpperCase() : null,
        total,
        addressId: input.addressId ?? null,
        items: { create: itemsData },
      },
      include: { items: true },
    });
  }).then(async (order) => {
    await createNotification({
      userId: order.userId,
      type: "ORDER_UPDATE",
      title: "Order confirmed",
      body: `Your order #${order.id.slice(-8).toUpperCase()} has been paid and is being processed.`,
      link: "/dashboard/orders",
    });
    return order;
  }).catch(async (err) => {
    // Payment has already succeeded via Stripe by the time this runs (webhook-driven),
    // so any failure here — most commonly losing a stock race to another buyer —
    // leaves the customer charged with no order. The webhook handler issues the
    // compensating Stripe refund; let the user know here.
    await createNotification({
      userId: input.userId,
      type: "ORDER_UPDATE",
      title: "Order couldn't be completed",
      body: err instanceof HttpError && err.status === 409
        ? "An item in your order sold out just before we could confirm it. You have not been charged — a refund is being processed."
        : "We couldn't complete your order after payment. A refund is being processed.",
      link: "/dashboard/orders",
    });
    throw err;
  });
}

export async function cancelMyOrder(userId: string, orderId: string, reason?: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { items: true } });
  if (!order) throw new HttpError(404, "Order not found");
  if (!(USER_CANCELLABLE_STATUSES as readonly string[]).includes(order.status)) {
    throw new HttpError(400, `Orders that are already ${order.status.toLowerCase()} can't be cancelled here — contact support.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    }
    return tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason ?? null },
    });
  });

  await createNotification({
    userId: updated.userId,
    type: "ORDER_UPDATE",
    title: "Order cancelled",
    body: `Your order #${updated.id.slice(-8).toUpperCase()} has been cancelled${reason ? `: ${reason}` : "."}`,
    link: "/dashboard/orders",
  });
  return updated;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function adminListOrders(opts: { status?: string; page?: number; limit?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, opts.limit ?? 20);
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (opts.status) where.status = opts.status;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where: where as any }),
    prisma.order.findMany({
      where: where as any,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
        address: true,
      },
    }),
  ]);

  return { orders, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function adminGetOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
      items: {
        include: { product: { select: { id: true, name: true, slug: true, imageUrls: true } } },
      },
      address: true,
    },
  });
  if (!order) throw new HttpError(404, "Order not found");
  return order;
}

export async function adminUpdateOrderStatus(orderId: string, status: string, reason?: string) {
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
    throw new HttpError(400, `Invalid status: ${status}`);
  }
  const order = await prisma.order.findFirst({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new HttpError(404, "Order not found");

  const enteringTerminalStockState =
    (TERMINAL_STOCK_STATUSES as readonly string[]).includes(status) &&
    !(TERMINAL_STOCK_STATUSES as readonly string[]).includes(order.status);

  const updated = await prisma.$transaction(async (tx) => {
    if (enteringTerminalStockState) {
      for (const item of order.items) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
    }
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: status as any,
        ...(status === "CANCELLED" ? { cancelledAt: new Date(), cancelReason: reason ?? order.cancelReason } : {}),
      },
    });
  });

  if (updated.status !== order.status) {
    await createNotification({
      userId: updated.userId,
      type: "ORDER_UPDATE",
      title: "Order status updated",
      body: `Your order #${updated.id.slice(-8).toUpperCase()} is now ${updated.status.toLowerCase()}.`,
      link: "/dashboard/orders",
    });
  }
  return updated;
}
