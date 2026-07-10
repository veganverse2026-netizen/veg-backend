import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { createNotification } from "../../modules/notifications/notifications.service.js";
import { resolveNotificationPrefs } from "../../shared/constants/settings.js";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const SLOT_SCHEDULE: { slot: string; label: string; cronTime: string }[] = [
  { slot: "breakfast", label: "breakfast", cronTime: "0 8 * * *" },
  { slot: "lunch", label: "lunch", cronTime: "0 13 * * *" },
  { slot: "dinner", label: "dinner", cronTime: "30 19 * * *" },
];

/**
 * Nudges members with an active meal plan who haven't logged the given meal
 * slot yet today. Deduped per slot per day (same title check the workout
 * reminders use), so a same-day restart can't double-remind.
 * Known limitation: fixed server-time slots — no per-user timezone exists.
 */
export async function runMealReminders(slot: string, label: string, now: Date = new Date()) {
  const today = startOfDay(now);
  const title = `Time for ${label}! 🥦`;

  const users = await prisma.user.findMany({
    where: { role: "MEMBER", mealPlanJson: { not: null } },
    select: { id: true, notificationPrefs: true }
  });

  let reminded = 0;
  for (const u of users) {
    if (!resolveNotificationPrefs(u.notificationPrefs).mealReminders) continue;
    const [logged, already] = await Promise.all([
      prisma.mealLog.findFirst({ where: { userId: u.id, slot, date: { gte: today } }, select: { id: true } }),
      prisma.notification.findFirst({ where: { userId: u.id, title, createdAt: { gte: today } }, select: { id: true } })
    ]);
    if (logged || already) continue;
    await createNotification({
      userId: u.id,
      type: "GYM",
      title,
      body: `Your plan has a ${label} waiting — log it once you've eaten to keep your streak honest.`,
      link: "/dashboard/meal-plans",
    });
    reminded++;
  }
  return reminded;
}

export function startMealReminderScheduler() {
  for (const s of SLOT_SCHEDULE) {
    cron.schedule(s.cronTime, () => {
      runMealReminders(s.slot, s.label).catch((err) => console.error("[meal-reminders] failed:", err));
    });
  }
  console.log("[scheduler] meal reminders scheduled (08:00, 13:00, 19:30 server time)");
}
