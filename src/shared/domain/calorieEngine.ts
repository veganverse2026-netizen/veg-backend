// Pure calculation functions — no DB access — shared between the onboarding
// goal-preview endpoint (before anything is saved) and meal-plan generation
// (after the goal is saved), so both use identical physiology math.

export interface BodyProfile {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  gender: string | null;
  activityLevel: string | null;
}

export type GoalKind = "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE";

// Mifflin-St Jeor gender terms and activity factors — identical to the
// values meal-plan-generator.ts's computeCalorieTarget has always used;
// kept here as the single source so both stay in sync.
const GENDER_TERM: Record<string, number> = { MALE: 5, FEMALE: -161 };
const ACTIVITY_FACTORS: Record<string, number> = { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, ATHLETE: 1.9 };
const DEFAULT_ACTIVITY_FACTOR = 1.4;
const FALLBACK_TDEE = 2000;

export function computeBMR(profile: BodyProfile): number | null {
  if (!profile.weightKg || !profile.heightCm || !profile.age) return null;
  const genderTerm = profile.gender != null ? (GENDER_TERM[profile.gender] ?? -78) : -78;
  return 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + genderTerm;
}

export function computeTDEE(profile: BodyProfile): number {
  const bmr = computeBMR(profile);
  if (bmr == null) return FALLBACK_TDEE;
  const factor = ACTIVITY_FACTORS[profile.activityLevel ?? ""] ?? DEFAULT_ACTIVITY_FACTOR;
  return Math.round((bmr * factor) / 10) * 10;
}

// Evidence-based simple safe-pace bounds:
// - Fat loss: 0.5-1% of bodyweight/week is the standard sustainable range.
// - Muscle gain (natural): 0.25-0.5% of bodyweight/week is the realistic ceiling.
const KCAL_PER_KG_FAT = 7700;
const FAT_LOSS_SAFE_RATE = 0.0075;
const FAT_LOSS_MAX_RATE = 0.01;
const MUSCLE_GAIN_SAFE_RATE = 0.00375;
const MUSCLE_GAIN_MAX_RATE = 0.005;
const MUSCLE_GAIN_MAX_SURPLUS_FRACTION = 0.2;
const FAT_LOSS_MIN_CALORIE_FLOOR = 1200;

export interface GoalPaceInput {
  goal: GoalKind;
  currentWeightKg: number;
  targetWeightKg: number | null;
  timelineWeeks: number | null;
}

export interface GoalPaceResult {
  isRealistic: boolean;
  recommendedWeeks: number | null;
  message: string;
}

export function evaluateGoalPace(input: GoalPaceInput): GoalPaceResult {
  const { goal, currentWeightKg, targetWeightKg, timelineWeeks } = input;
  if (goal === "LIFESTYLE" || targetWeightKg == null || timelineWeeks == null) {
    return { isRealistic: true, recommendedWeeks: null, message: "Maintaining your current weight — no pace to evaluate." };
  }
  const kgDelta = Math.abs(targetWeightKg - currentWeightKg);
  if (kgDelta === 0) {
    return { isRealistic: true, recommendedWeeks: timelineWeeks, message: "You're already at your target weight." };
  }
  const isLoss = goal === "FAT_LOSS";
  const maxRate = isLoss ? FAT_LOSS_MAX_RATE : MUSCLE_GAIN_MAX_RATE;
  const safeRate = isLoss ? FAT_LOSS_SAFE_RATE : MUSCLE_GAIN_SAFE_RATE;
  const recommendedWeeks = Math.max(1, Math.ceil(kgDelta / (currentWeightKg * safeRate)));
  const minRealisticWeeks = kgDelta / (currentWeightKg * maxRate);
  const isRealistic = timelineWeeks >= minRealisticWeeks;
  const verb = isLoss ? "lose" : "gain";
  const recommendedMonths = Math.round((recommendedWeeks / 4.345) * 10) / 10;
  const message = isRealistic
    ? `A ${timelineWeeks}-week timeline to ${verb} ${kgDelta.toFixed(1)}kg is within a safe, sustainable pace.`
    : `${isLoss ? "Losing" : "Gaining"} ${kgDelta.toFixed(1)}kg in ${timelineWeeks} weeks is faster than generally recommended. Based on your goal, we recommend a timeline of approximately ${recommendedMonths} months (${recommendedWeeks} weeks) for healthy and sustainable progress.`;
  return { isRealistic, recommendedWeeks, message };
}

export interface GoalCalorieInput {
  tdee: number;
  goal: GoalKind;
  currentWeightKg: number;
  targetWeightKg: number | null;
  timelineWeeks: number | null;
}

export function computeGoalCalorieTarget(input: GoalCalorieInput): number {
  const { tdee, goal, currentWeightKg, targetWeightKg, timelineWeeks } = input;
  if (goal === "LIFESTYLE" || targetWeightKg == null || timelineWeeks == null || timelineWeeks <= 0) {
    return tdee;
  }
  const kgDelta = targetWeightKg - currentWeightKg; // negative for loss, positive for gain
  const dailyKcalDelta = (kgDelta * KCAL_PER_KG_FAT) / (timelineWeeks * 7);
  let target = tdee + dailyKcalDelta;
  if (goal === "MUSCLE_BUILD") {
    target = Math.min(target, tdee * (1 + MUSCLE_GAIN_MAX_SURPLUS_FRACTION));
  } else if (goal === "FAT_LOSS") {
    // A very aggressive short timeline shouldn't crash calories to unsafe levels.
    target = Math.max(target, Math.max(FAT_LOSS_MIN_CALORIE_FLOOR, tdee * 0.6));
  }
  return Math.round(target / 10) * 10;
}

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

// Protein by goal: higher in a deficit to preserve lean mass, moderate in a
// surplus, and 1.6 g/kg at maintenance — matching the existing hardcoded
// default in meal-logs.service.ts so maintenance-goal users see no jump.
const PROTEIN_G_PER_KG: Record<GoalKind, number> = { FAT_LOSS: 2.0, MUSCLE_BUILD: 1.8, LIFESTYLE: 1.6 };
const FAT_CALORIE_FRACTION = 0.28;
const FAT_MIN_G_PER_KG = 0.5;

export function computeMacroTargets(input: { dailyCalorieTarget: number; goal: GoalKind; weightKg: number }): MacroTargets {
  const { dailyCalorieTarget, goal, weightKg } = input;
  const proteinG = Math.round(weightKg * (PROTEIN_G_PER_KG[goal] ?? 1.6));
  const fatG = Math.round(Math.max((dailyCalorieTarget * FAT_CALORIE_FRACTION) / 9, weightKg * FAT_MIN_G_PER_KG));
  const carbsG = Math.max(0, Math.round((dailyCalorieTarget - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, fatG, carbsG };
}

const HYDRATION_ML_PER_KG = 35;

export function computeHydrationTarget(weightKg: number | null): number {
  if (!weightKg) return 3500;
  return Math.round(weightKg * HYDRATION_ML_PER_KG);
}

export interface WeeklyProgressPoint {
  week: number;
  predictedWeightKg: number;
}

export function predictWeeklyProgress(input: { startWeightKg: number; targetWeightKg: number; timelineWeeks: number }): WeeklyProgressPoint[] {
  const { startWeightKg, targetWeightKg, timelineWeeks } = input;
  const weeks = Math.max(1, Math.round(timelineWeeks));
  const points: WeeklyProgressPoint[] = [];
  for (let week = 0; week <= weeks; week++) {
    const t = week / weeks;
    points.push({ week, predictedWeightKg: Math.round((startWeightKg + (targetWeightKg - startWeightKg) * t) * 10) / 10 });
  }
  return points;
}
