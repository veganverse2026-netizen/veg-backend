import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

const ORDER_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"] as const;

export async function listMyOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, slug: true, imageUrls: true } } },
      },
      address: true,
    },
  });
}

export async function getMyOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, slug: true, imageUrls: true } } },
      },
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

    return tx.order.create({
      data: {
        userId: input.userId,
        stripeSessionId: input.stripeSessionId,
        stripePaymentId: input.stripePaymentId ?? null,
        status: "PAID",
        subtotal,
        tax,
        shipping,
        total: subtotal + tax + shipping,
        addressId: input.addressId ?? null,
        items: { create: itemsData },
      },
      include: { items: true },
    });
  });
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

export async function adminUpdateOrderStatus(orderId: string, status: string) {
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
    throw new HttpError(400, `Invalid status: ${status}`);
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new HttpError(404, "Order not found");
  return prisma.order.update({
    where: { id: orderId },
    data: { status: status as any },
  });
}
