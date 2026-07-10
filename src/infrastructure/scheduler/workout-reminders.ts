import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { createNotification } from "../../modules/notifications/notifications.service.js";
import { resolveNotificationPrefs } from "../../shared/constants/settings.js";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const REMINDER_TITLE = "Time for today's workout!";

function startOfDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isRestDayInPlan(approvedGymPlanJson: string, todayLabel: string): boolean {
  try {
    const sessions = JSON.parse(approvedGymPlanJson);
    if (!Array.isArray(sessions)) return false;
    const today = sessions.find((s: any) => s?.day === todayLabel);
    if (!today) return false;
    return !Array.isArray(today.exercises) || today.exercises.length === 0;
  } catch {
    return false;
  }
}

// Reminds members who have a trainer-assigned plan and haven't logged a
// workout yet today — skips anyone whose plan marks today as a rest day, and
// anyone already reminded today (guards against duplicate cron fires, e.g.
// after a server restart on the same day).
export async function runWorkoutReminders(now: Date = new Date()) {
  const dayStart = startOfDay(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const todayLabel = WEEKDAY_LABELS[now.getDay()];

  const candidates = await prisma.user.findMany({
    where: {
      role: "MEMBER",
      gymTrainerId: { not: null },
      approvedGymPlanJson: { not: null }
    },
    select: { id: true, name: true, approvedGymPlanJson: true, notificationPrefs: true }
  });

  let remindedCount = 0;
  for (const member of candidates) {
    if (!member.approvedGymPlanJson) continue;
    if (!resolveNotificationPrefs(member.notificationPrefs).workoutReminders) continue;
    if (isRestDayInPlan(member.approvedGymPlanJson, todayLabel)) continue;

    const [loggedToday, alreadyRemindedToday] = await Promise.all([
      prisma.workoutLog.count({ where: { userId: member.id, performedAt: { gte: dayStart, lt: dayEnd } } }),
      prisma.notification.count({ where: { userId: member.id, title: REMINDER_TITLE, createdAt: { gte: dayStart, lt: dayEnd } } })
    ]);
    if (loggedToday > 0 || alreadyRemindedToday > 0) continue;

    await createNotification({
      userId: member.id,
      type: "GYM",
      title: REMINDER_TITLE,
      body: "You haven't logged a workout today. Keep your streak going!",
      link: "/dashboard/gym",
    });
    remindedCount++;
  }

  return { checked: candidates.length, reminded: remindedCount };
}

export function startWorkoutReminderScheduler() {
  // Once daily at 18:00 server time. No per-user timezone tracking exists in
  // this codebase yet, so this is a single fixed server-time slot for now.
  cron.schedule("0 18 * * *", () => {
    runWorkoutReminders().catch((err) => {
      console.error("[workout-reminders] failed:", err);
    });
  });
}
