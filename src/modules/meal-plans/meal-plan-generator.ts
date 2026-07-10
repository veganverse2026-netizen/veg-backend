import { MEAL_LIBRARY, type LibraryMeal, type MealSlot } from "./meal-library.js";

export interface PlanMeal {
  slot: "breakfast" | "morning-snack" | "lunch" | "evening-snack" | "dinner";
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: string[];
  instructions: string;
  /** Same-slot second choice, scaled to the same calorie budget — the member
      picks either at logging time without a trainer request. */
  alternative?: Omit<PlanMeal, "alternative">;
}

export interface PlanDay {
  day: string;
  dayType?: "training" | "rest";
  meals: PlanMeal[];
}

export interface MealPlanMeta {
  id: string;
  name: string;
  goal: string;
  dailyCalories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  durationWeeks: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  description: string;
}

export interface GeneratedMealPlan {
  meta: MealPlanMeta;
  week: PlanDay[];
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Share of daily calories per meal slot — standard 3-meals-2-snacks split
const SLOT_BUDGET: { slot: PlanMeal["slot"]; library: MealSlot; share: number }[] = [
  { slot: "breakfast", library: "breakfast", share: 0.25 },
  { slot: "morning-snack", library: "snack", share: 0.10 },
  { slot: "lunch", library: "lunch", share: 0.30 },
  { slot: "evening-snack", library: "snack", share: 0.10 },
  { slot: "dinner", library: "dinner", share: 0.25 },
];

interface UserProfile {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  gender: string | null;
  activityLevel: string | null;
  goal: string | null;
  dietaryPreferences: string[];
  calorieTargetOverride: number | null;
}

export interface GeneratorContext {
  /** Trainer-approved gym plan JSON — enables training-day fuel sync */
  gymPlanJson?: string | null;
  /** Meal names this member keeps skipping — deprioritized or dropped */
  dislikedNames?: string[];
}

/* Training-day sync: days with a gym session get a fuel bump, rest days a
   trim. Factors chosen so a typical 4-training-day week averages ~target. */
const TRAINING_DAY_FACTOR = 1.08;
const REST_DAY_FACTOR = 0.94;

function trainingDaysFrom(gymPlanJson: string | null | undefined): Set<string> | null {
  if (!gymPlanJson) return null;
  try {
    const sessions = JSON.parse(gymPlanJson);
    if (!Array.isArray(sessions)) return null;
    const days = new Set<string>();
    for (const sess of sessions) {
      if (typeof sess?.day === "string" && Array.isArray(sess.exercises) && sess.exercises.length > 0) {
        days.add(sess.day.trim().toLowerCase());
      }
    }
    return days.size > 0 ? days : null;
  } catch {
    return null;
  }
}

/* Mifflin-St Jeor with activity factor — same formula the Progress page shows */
export function computeCalorieTarget(user: UserProfile): number {
  if (user.calorieTargetOverride) return user.calorieTargetOverride;
  if (!user.weightKg || !user.heightCm || !user.age) return 2000;
  const genderTerm = user.gender === "MALE" ? 5 : user.gender === "FEMALE" ? -161 : -78;
  const bmr = 10 * user.weightKg + 6.25 * user.heightCm - 5 * user.age + genderTerm;
  const factors: Record<string, number> = { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, ATHLETE: 1.9 };
  return Math.round((bmr * (factors[user.activityLevel ?? ""] ?? 1.4)) / 10) * 10;
}

interface PlanTemplate {
  id: string;
  name: string;
  goal: string;
  calorieFactor: number;
  proteinShare: number; // fraction of calories
  fatShare: number;
  durationWeeks: number;
  difficulty: MealPlanMeta["difficulty"];
  description: string;
  preferTag?: string;
  matchGoals: string[]; // user goals this template suits best (for ordering)
}

const TEMPLATES: PlanTemplate[] = [
  {
    id: "fat-loss-kickstart", name: "Fat Loss Kickstart", goal: "Fat Loss",
    calorieFactor: 0.82, proteinShare: 0.30, fatShare: 0.28,
    durationWeeks: 8, difficulty: "Beginner",
    description: "A satisfying calorie deficit built on fiber-rich plants that keep you full while the fat comes off.",
    preferTag: "high-protein",
    matchGoals: ["FAT_LOSS"],
  },
  {
    id: "lean-muscle-builder", name: "Lean Muscle Builder", goal: "Muscle Gain",
    calorieFactor: 1.12, proteinShare: 0.28, fatShare: 0.25,
    durationWeeks: 12, difficulty: "Intermediate",
    description: "A plant-protein-forward surplus to fuel training and build lean mass without junk calories.",
    preferTag: "high-protein",
    matchGoals: ["MUSCLE_BUILD"],
  },
  {
    id: "balanced-lifestyle", name: "Balanced Vegan Lifestyle", goal: "Maintenance",
    calorieFactor: 1.0, proteinShare: 0.22, fatShare: 0.30,
    durationWeeks: 6, difficulty: "Beginner",
    description: "Effortless day-to-day plant eating at maintenance calories — variety first, no obsessing.",
    matchGoals: ["LIFESTYLE"],
  },
  {
    id: "high-protein-performance", name: "High-Protein Performance", goal: "Performance",
    calorieFactor: 1.05, proteinShare: 0.32, fatShare: 0.25,
    durationWeeks: 10, difficulty: "Advanced",
    description: "Maximum plant protein for hard training weeks — every meal pulls its weight.",
    preferTag: "high-protein",
    matchGoals: ["MUSCLE_BUILD", "FAT_LOSS"],
  },
  {
    id: "vegan-transition", name: "New Vegan Transition", goal: "Transition",
    calorieFactor: 1.0, proteinShare: 0.22, fatShare: 0.30,
    durationWeeks: 4, difficulty: "Beginner",
    description: "New to plant-based? Familiar comfort dishes — tacos, pasta, pancakes, bowls — 100% vegan from day one, zero intimidation.",
    preferTag: "comfort",
    matchGoals: [],
  },
];

const EXCLUDE_BY_PREF: Record<string, string> = {
  "soy-free": "soy",
  "gluten-free": "gluten",
  "nut-free": "nuts",
};

function eligibleMeals(prefs: string[]): LibraryMeal[] {
  const excluded = prefs.map(p => EXCLUDE_BY_PREF[p]).filter(Boolean);
  return MEAL_LIBRARY.filter(m => !m.tags.some(t => excluded.includes(t)));
}

function scaleMeal(meal: LibraryMeal, slot: PlanMeal["slot"], budget: number): PlanMeal {
  // Portion factor clamped so meals stay realistic
  const factor = Math.min(1.6, Math.max(0.7, budget / meal.calories));
  const r = (v: number) => Math.round(v * factor);
  return {
    slot,
    name: meal.name,
    quantity: factor >= 0.95 && factor <= 1.05 ? "1 serving" : `${(Math.round(factor * 4) / 4).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")} servings`,
    calories: r(meal.calories),
    protein: r(meal.protein),
    carbs: r(meal.carbs),
    fat: r(meal.fat),
    fiber: r(meal.fiber),
    ingredients: meal.ingredients,
    instructions: meal.instructions,
  };
}

function buildWeek(template: PlanTemplate, dailyCalories: number, prefs: string[], ctx?: GeneratorContext): PlanDay[] {
  const pool = eligibleMeals(prefs);
  const disliked = new Set((ctx?.dislikedNames ?? []).map(n => n.toLowerCase()));
  const bySlot = new Map<MealSlot, LibraryMeal[]>();
  for (const s of ["breakfast", "snack", "lunch", "dinner"] as MealSlot[]) {
    let list = pool.filter(m => m.slot === s);
    if (template.preferTag === "high-protein") {
      // Protein-forward plans rotate within the most protein-dense meals for
      // the slot (keep at least 3 for variety) instead of the whole pool —
      // otherwise the rotation dilutes protein right back to the average.
      const sorted = [...list].sort((a, b) => b.protein / b.calories - a.protein / a.calories);
      list = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.6)));
    } else if (template.preferTag === "comfort") {
      const comfy = list.filter(m => m.tags.includes("comfort"));
      if (comfy.length >= 3) list = comfy;
    }
    // Adaptive plate: drop meals this member keeps skipping, as long as the
    // slot keeps enough variety; otherwise just push them to the back.
    if (disliked.size > 0) {
      const liked = list.filter(m => !disliked.has(m.name.toLowerCase()));
      list = liked.length >= 3 ? liked : [...liked, ...list.filter(m => disliked.has(m.name.toLowerCase()))];
    }
    bySlot.set(s, list);
  }

  // Deterministic rotation offset per template so the plans differ
  const offset = TEMPLATES.findIndex(t => t.id === template.id);
  const trainingDays = trainingDaysFrom(ctx?.gymPlanJson);

  return DAYS.map((day, dayIdx) => {
    const dayType: PlanDay["dayType"] = trainingDays
      ? (trainingDays.has(day.toLowerCase()) ? "training" : "rest")
      : undefined;
    const dayCalories = dailyCalories * (dayType === "training" ? TRAINING_DAY_FACTOR : dayType === "rest" ? REST_DAY_FACTOR : 1);
    return {
      day,
      ...(dayType ? { dayType } : {}),
      meals: SLOT_BUDGET.map((sb) => {
        const list = bySlot.get(sb.library)!;
        const idx = dayIdx + offset + (sb.slot === "evening-snack" ? 3 : 0);
        const meal = list[idx % list.length];
        const scaled = scaleMeal(meal, sb.slot, dayCalories * sb.share);
        // Offer a second option so members get choice without a change
        // request — pick the rotation candidate whose scaled calories land
        // closest to the primary's, so both options fit the same targets.
        let best: ReturnType<typeof scaleMeal> | null = null;
        for (let step = 1; step < list.length; step++) {
          const candidate = list[(idx + step) % list.length];
          if (candidate.name === meal.name) continue;
          const candScaled = scaleMeal(candidate, sb.slot, dayCalories * sb.share);
          if (!best || Math.abs(candScaled.calories - scaled.calories) < Math.abs(best.calories - scaled.calories)) {
            best = candScaled;
          }
          if (best && Math.abs(best.calories - scaled.calories) / scaled.calories <= 0.08) break;
        }
        if (best) scaled.alternative = best;
        return scaled;
      }),
    };
  });
}

export function generateRecommendations(user: UserProfile, ctx?: GeneratorContext): GeneratedMealPlan[] {
  const maintenance = computeCalorieTarget(user);

  const plans = TEMPLATES.map(t => {
    const dailyCalories = Math.round((maintenance * t.calorieFactor) / 10) * 10;
    const week = buildWeek(t, dailyCalories, user.dietaryPreferences, ctx);

    // The meta targets users measure themselves against must match what the
    // composed week actually delivers — never the template's aspiration
    // (template shares only steer meal selection inside buildWeek).
    const days = week.length;
    const totals = week.reduce(
      (acc, d) => {
        for (const m of d.meals) {
          acc.calories += m.calories; acc.protein += m.protein; acc.carbs += m.carbs;
          acc.fat += m.fat; acc.fiber += m.fiber;
        }
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
    return {
      meta: {
        id: t.id, name: t.name, goal: t.goal,
        dailyCalories: Math.round(totals.calories / days / 10) * 10,
        protein: Math.round(totals.protein / days),
        carbs: Math.round(totals.carbs / days),
        fat: Math.round(totals.fat / days),
        fiber: Math.round(totals.fiber / days),
        durationWeeks: t.durationWeeks, difficulty: t.difficulty, description: t.description,
      },
      week,
    };
  });

  // Best-matching plans for the user's goal first
  return plans.sort((a, b) => {
    const am = TEMPLATES.find(t => t.id === a.meta.id)!.matchGoals.includes(user.goal ?? "") ? 0 : 1;
    const bm = TEMPLATES.find(t => t.id === b.meta.id)!.matchGoals.includes(user.goal ?? "") ? 0 : 1;
    return am - bm;
  });
}
