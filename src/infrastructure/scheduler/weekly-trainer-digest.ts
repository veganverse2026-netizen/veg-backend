import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import { createNotification } from "../../modules/notifications/notifications.service.js";
import { analyzeNutrientCoverage } from "../../modules/meal-plans/meal-nutrients.js";
import { computeDislikedMeals } from "../../modules/meal-plans/meal-plans.service.js";

const SLOT_COUNT = 5;

function isoWeekLabel(d: Date) {
  const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function memberDigestLine(member: { id: string; name: string | null; mealPlanJson: string | null }) {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 6);

  const logs = await prisma.mealLog.findMany({
    where: { userId: member.id, date: { gte: from } },
    select: { date: true, slot: true, status: true, calories: true, name: true }
  });

  // Adherence: distinct handled meal slots per day / 5, averaged over the week
  const slotsByDay = new Map<string, Set<string>>();
  for (const l of logs) {
    if (l.slot === "water" || l.slot === "custom") continue;
    const k = l.date.toISOString().slice(0, 10);
    if (!slotsByDay.has(k)) slotsByDay.set(k, new Set());
    slotsByDay.get(k)!.add(l.slot);
  }
  const handled = [...slotsByDay.values()].reduce((s, set) => s + set.size, 0);
  const adherence = Math.round((handled / (SLOT_COUNT * 7)) * 100);

  let target: number | null = null;
  try { target = member.mealPlanJson ? JSON.parse(member.mealPlanJson)?.meta?.dailyCalories ?? null : null; } catch {}
  const calByDay = new Map<string, number>();
  for (const l of logs) {
    if (l.status !== "completed") continue;
    const k = l.date.toISOString().slice(0, 10);
    calByDay.set(k, (calByDay.get(k) ?? 0) + l.calories);
  }
  const avgCal = calByDay.size ? Math.round([...calByDay.values()].reduce((a, b) => a + b, 0) / calByDay.size) : 0;
  const calNote = target && avgCal ? `${avgCal}/${target} kcal avg` : "no calories logged";

  const [disliked, nutrients] = await Promise.all([
    computeDislikedMeals(member.id),
    analyzeNutrientCoverage(member.id, 7)
  ]);
  const lows = nutrients.filter(n => n.status === "low" || n.status === "critical").map(n => n.label);
  const parts = [`${member.name ?? "Member"}: ${adherence}% meals handled, ${calNote}`];
  if (disliked[0]) parts.push(`skips ${disliked[0].name} (${disliked[0].skips}×)`);
  if (lows.length) parts.push(`low: ${lows.join(", ")}`);
  return { line: parts.join(" · "), criticalNutrients: nutrients.filter(n => n.status === "critical").map(n => n.label) };
}

/**
 * Monday-morning digest: one notification per trainer summarizing each
 * assigned member's last-7-day nutrition, plus separate 🛡️ Nutrient
 * Guardian alerts for critically-low members. Deduped per ISO week.
 */
export async function runWeeklyTrainerDigest(now: Date = new Date()) {
  const week = isoWeekLabel(now);
  const digestTitle = `📬 Weekly nutrition digest (${week})`;

  const trainers = await prisma.gymTrainer.findMany({
    where: { approved: true, linkedUserId: { not: null } },
    select: {
      linkedUserId: true,
      assignedUsers: { select: { id: true, name: true, mealPlanJson: true }, where: { mealPlanJson: { not: null } } }
    }
  });

  let sent = 0;
  for (const t of trainers) {
    if (!t.linkedUserId || t.assignedUsers.length === 0) continue;
    const already = await prisma.notification.findFirst({
      where: { userId: t.linkedUserId, title: digestTitle }, select: { id: true }
    });
    if (already) continue;

    const results = [];
    for (const m of t.assignedUsers.slice(0, 6)) results.push({ member: m, ...(await memberDigestLine(m)) });
    const extra = t.assignedUsers.length > 6 ? ` (+${t.assignedUsers.length - 6} more members)` : "";

    await createNotification({
      userId: t.linkedUserId,
      type: "GYM",
      title: digestTitle,
      body: results.map(r => r.line).join(" | ") + extra,
      link: "/dashboard/gym-trainer",
    });
    sent++;

    // Guardian alerts for critical members (deduped per week per member)
    for (const r of results) {
      if (r.criticalNutrients.length === 0) continue;
      const alertTitle = `🛡️ Nutrient alert: ${r.member.name ?? "member"} (${week})`;
      const dup = await prisma.notification.findFirst({ where: { userId: t.linkedUserId, title: alertTitle }, select: { id: true } });
      if (dup) continue;
      await createNotification({
        userId: t.linkedUserId,
        type: "GYM",
        title: alertTitle,
        body: `${r.member.name ?? "A member"} has had almost no ${r.criticalNutrients.join(" or ")} sources this week — consider swapping richer meals into their plan.`,
        link: "/dashboard/gym-trainer",
      });
    }
  }
  return sent;
}

export function startWeeklyTrainerDigestScheduler() {
  cron.schedule("0 9 * * 1", () => {
    runWeeklyTrainerDigest().catch(err => console.error("[trainer-digest] failed:", err));
  });
  console.log("[scheduler] weekly trainer digest scheduled (Mon 09:00 server time)");
}
