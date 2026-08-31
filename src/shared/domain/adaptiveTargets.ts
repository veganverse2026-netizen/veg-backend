import { prisma } from "../../infrastructure/db/prisma.js";
import { computeMacroTargets, computeTDEE, computeGoalCalorieTarget, type GoalKind } from "./calorieEngine.js";

// Same constant already used for the Impact stats and the streak engine's
// sibling calorieEngine.ts (KCAL_PER_KG_FAT) — kept local since
// calorieEngine.ts doesn't export it.
const KCAL_PER_KG_FAT = 7700;
const MIN_RECOMPUTE_INTERVAL_DAYS = 7;
const MAX_WEEKLY_ADJUSTMENT_KCAL = 200;
const MIN_CALORIE_FLOOR = 1200;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface AdaptiveTargetResult {
  calorieTarget: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  note: string;
  updatedAt: Date;
}

/**
 * Recalculates the user's adaptive nutrition target from their actual
 * logged weight trend vs. their goal's planned pace — at most once per
 * MIN_RECOMPUTE_INTERVAL_DAYS, and only for users on an active weight-goal
 * timeline (FAT_LOSS/MUSCLE_BUILD with a target weight + timeline) who
 * haven't set a manual calorieTargetOverride, since an explicit user choice
 * is never second-guessed by the algorithm. Meant to be called lazily from
 * a read path (mirrors the streak-freeze replenishment pattern) — cheap
 * no-op when nothing needs recomputing.
 */
export async function maybeRecomputeAdaptiveTarget(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      goal: true,
      weightKg: true,
      heightCm: true,
      age: true,
      gender: true,
      activityLevel: true,
      goalTargetWeightKg: true,
      goalStartWeightKg: true,
      goalTimelineWeeks: true,
      goalSetAt: true,
      calorieTargetOverride: true,
      adaptiveCalorieTarget: true,
      adaptiveTargetUpdatedAt: true
    }
  });
  if (!user) return;

  // An explicit user override is never second-guessed — don't even spend
  // the effort computing something that will never be read.
  if (user.calorieTargetOverride != null) return;

  const goal = user.goal as GoalKind | null;
  if (
    !goal || goal === "LIFESTYLE" ||
    user.goalTargetWeightKg == null || user.goalStartWeightKg == null ||
    user.goalTimelineWeeks == null || !user.goalSetAt
  ) {
    return;
  }

  if (
    user.adaptiveTargetUpdatedAt &&
    Date.now() - user.adaptiveTargetUpdatedAt.getTime() < MIN_RECOMPUTE_INTERVAL_DAYS * 24 * 60 * 60 * 1000
  ) {
    return;
  }

  const weeksElapsed = (Date.now() - user.goalSetAt.getTime()) / (7 * 24 * 60 * 60 * 1000);
  if (weeksElapsed < 1) return; // nothing meaningful to adapt from in week one

  const entries = await prisma.tracker.findMany({
    where: { userId, date: { gte: daysAgo(14) }, weightKg: { not: null } },
    select: { date: true, weightKg: true },
    orderBy: { date: "desc" }
  });

  const thisWeek = entries.filter((e) => e.date >= daysAgo(7)).map((e) => e.weightKg!) ;
  const lastWeek = entries.filter((e) => e.date < daysAgo(7)).map((e) => e.weightKg!);
  const avgThisWeek = average(thisWeek);
  const avgLastWeek = average(lastWeek);

  const tdee = computeTDEE(user);
  const baselineTarget =
    user.adaptiveCalorieTarget ??
    computeGoalCalorieTarget({
      tdee,
      goal,
      currentWeightKg: user.weightKg ?? user.goalStartWeightKg,
      targetWeightKg: user.goalTargetWeightKg,
      timelineWeeks: user.goalTimelineWeeks
    });

  // Not enough recent weigh-ins to trust a week-over-week comparison — keep
  // the existing target rather than adjust from noise, and say so plainly.
  if (avgThisWeek == null || avgLastWeek == null) {
    const macros = computeMacroTargets({ dailyCalorieTarget: baselineTarget, goal, weightKg: user.weightKg ?? user.goalStartWeightKg });
    await prisma.user.update({
      where: { id: userId },
      data: {
        adaptiveCalorieTarget: baselineTarget,
        adaptiveProteinTarget: macros.proteinG,
        adaptiveCarbsTarget: macros.carbsG,
        adaptiveFatTarget: macros.fatG,
        adaptiveTargetNote: "Log your weight a bit more regularly (at least once in each of the last two weeks) to unlock weekly target adjustments.",
        adaptiveTargetUpdatedAt: new Date()
      }
    });
    return;
  }

  const actualWeeklyRateKg = avgThisWeek - avgLastWeek;
  const targetWeeklyRateKg = (user.goalTargetWeightKg - user.goalStartWeightKg) / user.goalTimelineWeeks;
  const rateDeltaKg = actualWeeklyRateKg - targetWeeklyRateKg;

  const rawAdjustment = -(rateDeltaKg * KCAL_PER_KG_FAT) / 7;
  const adjustment = Math.max(-MAX_WEEKLY_ADJUSTMENT_KCAL, Math.min(MAX_WEEKLY_ADJUSTMENT_KCAL, rawAdjustment));

  let newTarget = Math.round((baselineTarget + adjustment) / 10) * 10;
  newTarget = Math.max(MIN_CALORIE_FLOOR, Math.min(newTarget, Math.round(tdee * 1.25)));

  const isLoss = goal === "FAT_LOSS";
  const onPace = Math.abs(adjustment) < 40; // small deltas aren't worth narrating as a correction
  let note: string;
  if (onPace) {
    note = `You're tracking close to plan — target unchanged at ${newTarget} kcal/day.`;
  } else if (adjustment < 0) {
    // adjustment < 0 means "reduce calories," which for a loss goal means
    // losing SLOWER than planned (need more deficit), and for a gain goal
    // means gaining FASTER than planned (need less surplus) — the two
    // goals hit this branch for opposite real-world reasons.
    note = isLoss
      ? `You lost ${Math.abs(actualWeeklyRateKg).toFixed(1)}kg this week vs. a ${Math.abs(targetWeeklyRateKg).toFixed(1)}kg pace — trimmed ${Math.abs(Math.round(adjustment))} kcal to get back on track.`
      : `You gained ${actualWeeklyRateKg.toFixed(1)}kg this week, faster than your ${targetWeeklyRateKg.toFixed(1)}kg pace — trimmed ${Math.abs(Math.round(adjustment))} kcal to keep gains lean and sustainable.`;
  } else {
    note = isLoss
      ? `You're losing faster than your planned safe pace — added ${Math.round(adjustment)} kcal to keep this sustainable.`
      : `You gained ${actualWeeklyRateKg.toFixed(1)}kg this week vs. a ${targetWeeklyRateKg.toFixed(1)}kg pace — added ${Math.round(adjustment)} kcal to help you catch up.`;
  }

  const macros = computeMacroTargets({ dailyCalorieTarget: newTarget, goal, weightKg: avgThisWeek });

  await prisma.user.update({
    where: { id: userId },
    data: {
      adaptiveCalorieTarget: newTarget,
      adaptiveProteinTarget: macros.proteinG,
      adaptiveCarbsTarget: macros.carbsG,
      adaptiveFatTarget: macros.fatG,
      adaptiveTargetNote: note,
      adaptiveTargetUpdatedAt: new Date()
    }
  });
}

export async function getAdaptiveTargetStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      calorieTargetOverride: true,
      adaptiveCalorieTarget: true,
      adaptiveProteinTarget: true,
      adaptiveCarbsTarget: true,
      adaptiveFatTarget: true,
      adaptiveTargetNote: true,
      adaptiveTargetUpdatedAt: true
    }
  });
  if (!user) return null;

  return {
    active: user.calorieTargetOverride == null && user.adaptiveCalorieTarget != null,
    calorieTarget: user.adaptiveCalorieTarget,
    proteinG: user.adaptiveProteinTarget,
    carbsG: user.adaptiveCarbsTarget,
    fatG: user.adaptiveFatTarget,
    note: user.adaptiveTargetNote,
    updatedAt: user.adaptiveTargetUpdatedAt
  };
}
