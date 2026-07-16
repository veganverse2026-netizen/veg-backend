import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { createNotification } from "../notifications/notifications.service.js";
import { computeCalorieTarget } from "./meal-plan-generator.js";
import { computeMacroTargets, computeHydrationTarget, type GoalKind } from "../../shared/domain/calorieEngine.js";

const SLOTS = ["breakfast", "morning-snack", "lunch", "evening-snack", "dinner"] as const;

function dayBounds(dateStr?: string) {
  const base = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(base.getTime())) throw new HttpError(400, "Invalid date");
  const from = new Date(base); from.setHours(0, 0, 0, 0);
  const to = new Date(from); to.setDate(to.getDate() + 1);
  return { from, to };
}

export interface MealLogInput {
  slot: string;
  name: string;
  quantity?: string | null;
  status?: "completed" | "skipped";
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  waterMl?: number;
}

export async function addMealLog(userId: string, input: MealLogInput) {
  const log = await prisma.mealLog.create({
    data: {
      userId,
      slot: input.slot,
      name: input.name,
      quantity: input.quantity ?? null,
      status: input.status ?? "completed",
      calories: Math.max(0, Math.round(input.calories ?? 0)),
      protein: Math.max(0, input.protein ?? 0),
      carbs: Math.max(0, input.carbs ?? 0),
      fat: Math.max(0, input.fat ?? 0),
      fiber: Math.max(0, input.fiber ?? 0),
      waterMl: Math.max(0, Math.round(input.waterMl ?? 0))
    }
  });

  await maybeNotifyGoalsComplete(userId);
  return log;
}

export async function deleteMealLog(userId: string, id: string) {
  const row = await prisma.mealLog.findUnique({ where: { id }, select: { userId: true } });
  if (!row || row.userId !== userId) throw new HttpError(404, "Log not found");
  await prisma.mealLog.delete({ where: { id } });
  return { deleted: true };
}

export async function listMealLogs(userId: string, dateStr?: string) {
  const { from, to } = dayBounds(dateStr);
  return prisma.mealLog.findMany({
    where: { userId, date: { gte: from, lt: to } },
    orderBy: { date: "asc" }
  });
}

export async function getDailySummary(userId: string, dateStr?: string) {
  const { from, to } = dayBounds(dateStr);
  const [logs, user] = await Promise.all([
    prisma.mealLog.findMany({ where: { userId, date: { gte: from, lt: to } } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        mealPlanJson: true, weightKg: true, heightCm: true, age: true, gender: true,
        activityLevel: true, goal: true, dietaryStyle: true, dietaryPreferences: true,
        calorieTargetOverride: true, proteinTargetOverride: true, hydrationTargetOverride: true,
        carbsTargetOverride: true, fatTargetOverride: true
      }
    })
  ]);
  if (!user) throw new HttpError(404, "User not found");

  const consumed = logs.filter(l => l.status === "completed").reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories,
      protein: acc.protein + l.protein,
      carbs: acc.carbs + l.carbs,
      fat: acc.fat + l.fat,
      fiber: acc.fiber + l.fiber,
      waterMl: acc.waterMl + l.waterMl
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, waterMl: 0 }
  );

  // Targets: active plan meta wins, then overrides, then computed defaults
  let plan: any = null;
  try { plan = user.mealPlanJson ? JSON.parse(user.mealPlanJson) : null; } catch {}
  const calorieTarget = plan?.meta?.dailyCalories ?? user.calorieTargetOverride ?? computeCalorieTarget(user);
  // Computed macro defaults (protein by goal, fat as a % of calories, carbs
  // as the remainder) — only when weightKg is known, same guard the old
  // protein-only default used. Goal defaults to LIFESTYLE (1.6 g/kg protein)
  // when unset, matching the previous hardcoded behavior exactly.
  const computedMacros = user.weightKg
    ? computeMacroTargets({ dailyCalorieTarget: calorieTarget, goal: (user.goal as GoalKind) ?? "LIFESTYLE", weightKg: user.weightKg })
    : null;
  const proteinTarget = plan?.meta?.protein ?? user.proteinTargetOverride ?? computedMacros?.proteinG ?? null;
  // Hydration: profile override wins (stored in liters, but tolerate ml
  // values defensively); default is now bodyweight-based (35 ml/kg) instead
  // of a flat 3.5L for everyone.
  const hydration = user.hydrationTargetOverride;
  const waterMl = hydration ? Math.round(hydration > 100 ? hydration : hydration * 1000) : computeHydrationTarget(user.weightKg);
  const targets = {
    calories: calorieTarget,
    protein: proteinTarget,
    carbs: plan?.meta?.carbs ?? user.carbsTargetOverride ?? computedMacros?.carbsG ?? null,
    fat: plan?.meta?.fat ?? user.fatTargetOverride ?? computedMacros?.fatG ?? null,
    fiber: plan?.meta?.fiber ?? Math.round((calorieTarget / 1000) * 14),
    waterMl
  };

  const handledSlots = new Set(logs.filter(l => SLOTS.includes(l.slot as any)).map(l => l.slot));
  const completion = Math.round((handledSlots.size / SLOTS.length) * 100);

  return { date: from.toISOString(), consumed, targets, completion, logs };
}

/* Fire "daily goals completed" once per day, when all 5 meal slots are
   handled AND calorie intake reached ≥90% of target. */
async function maybeNotifyGoalsComplete(userId: string) {
  const summary = await getDailySummary(userId);
  if (summary.completion < 100) return;
  if (summary.targets.calories && summary.consumed.calories < summary.targets.calories * 0.9) return;

  const { from } = dayBounds();
  const already = await prisma.notification.findFirst({
    where: { userId, title: "Daily nutrition goals hit! 🎉", createdAt: { gte: from } }
  });
  if (already) return;

  await createNotification({
    userId,
    type: "GYM",
    title: "Daily nutrition goals hit! 🎉",
    body: `All meals handled and ${summary.consumed.calories} kcal logged. Consistency wins.`,
    link: "/dashboard/meal-plans",
  });
}
