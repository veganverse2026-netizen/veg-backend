import { prisma } from "../../infrastructure/db/prisma.js";
import type { NotificationType } from "@prisma/client";
import { resolveNotificationPrefs, type NotificationPrefs } from "../../shared/constants/settings.js";

const TYPE_TO_PREF: Record<NotificationType, keyof NotificationPrefs> = {
  ORDER_UPDATE: "orderUpdates",
  COMMUNITY: "community",
  GYM: "gym",
  MEAL: "meals",
  SYSTEM: "system",
};

export function notificationTypeEnabled(storedPrefs: unknown, type: NotificationType) {
  return resolveNotificationPrefs(storedPrefs)[TYPE_TO_PREF[type]];
}

export async function listMyNotifications(userId: string, opts: { limit?: number; unreadOnly?: boolean }) {
  const limit = Math.min(50, opts.limit ?? 20);
  const where: any = { userId };
  if (opts.unreadOnly) where.read = false;
  return prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(userId: string, id: string) {
  const n = await prisma.notification.findFirst({ where: { id, userId } });
  if (!n) return null;
  return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  return { ok: true };
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { notificationPrefs: true }
  });
  if (!user) return null;
  if (!notificationTypeEnabled(user.notificationPrefs, input.type)) return null;
  return prisma.notification.create({ data: { ...input } });
}

export async function broadcastNotification(input: {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  roleFilter?: string;
}) {
  const where = input.roleFilter ? { role: input.roleFilter as any } : undefined;
  const users = await prisma.user.findMany({ where, select: { id: true, notificationPrefs: true } });
  const data = users
    .filter((u) => notificationTypeEnabled(u.notificationPrefs, input.type))
    .map((u) => ({
      userId: u.id,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    }));
  const result = await prisma.notification.createMany({ data });
  return { sent: result.count };
}

export async function adminListNotifications(opts: { page?: number; limit?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, opts.limit ?? 50);
  const skip = (page - 1) * limit;
  const [total, items] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  return { total, page, limit, pages: Math.ceil(total / limit), items };
}

export async function deleteNotification(id: string) {
  await prisma.notification.delete({ where: { id } });
  return { ok: true };
}

export async function deleteMyNotification(userId: string, id: string) {
  const n = await prisma.notification.findFirst({ where: { id, userId } });
  if (!n) return null;
  await prisma.notification.delete({ where: { id } });
  return { ok: true, wasUnread: !n.read };
}

export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({ where: { userId, read: false } });
  return { count };
}
