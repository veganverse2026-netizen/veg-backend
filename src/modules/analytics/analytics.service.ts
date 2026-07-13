import { prisma } from "../../infrastructure/db/prisma.js";
import type { OrderStatus } from "@prisma/client";

// Orders are only ever created with status PAID (Stripe confirms payment
// before an Order row exists), so these are the statuses that represent
// money actually collected and not yet reversed.
const REVENUE_STATUSES: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];

export async function getSalesAnalytics(days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [revenueAgg, orderCount, statusGroups, topProductsRaw, periodOrders, recentOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES } },
      _sum: { total: true }
    }),
    prisma.order.count(),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: { in: REVENUE_STATUSES } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5
    }),
    prisma.order.findMany({
      where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: since } },
      select: { total: true, createdAt: true }
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } }
    })
  ]);

  const productIds = topProductsRaw.map((p) => p.productId);
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, imageUrls: true } })
    : [];

  const topProducts = topProductsRaw.map((tp) => {
    const p = products.find((pp) => pp.id === tp.productId);
    return {
      productId: tp.productId,
      name: p?.name ?? "Unknown product",
      image: p?.imageUrls?.[0] ?? null,
      unitsSold: tp._sum?.quantity ?? 0,
      revenue: tp._sum?.total ?? 0
    };
  });

  const dailyMap = new Map<string, number>();
  for (const o of periodOrders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + o.total);
  }
  const dailyRevenue = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));

  const totalRevenue = revenueAgg._sum?.total ?? 0;

  return {
    totalRevenue,
    orderCount,
    avgOrderValue: orderCount > 0 ? totalRevenue / orderCount : 0,
    statusBreakdown: statusGroups.map((s) => ({ status: s.status, count: s._count._all })),
    topProducts,
    dailyRevenue,
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
      customer: o.user.name ?? o.user.email ?? "Unknown"
    }))
  };
}
