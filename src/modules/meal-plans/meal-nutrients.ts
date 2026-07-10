import { prisma } from "../../infrastructure/db/prisma.js";
import { MEAL_LIBRARY } from "./meal-library.js";

/**
 * Vegan Nutrient Guardian — tracks FOOD-SOURCE COVERAGE of the five
 * vegan-critical micronutrients, not fabricated milligram counts. A day
 * "covers" a nutrient when the member logged at least one recognized food
 * source of it. Honest, explainable, and actionable ("add chia or walnuts").
 */

export const GUARDIAN_NUTRIENTS = [
  {
    key: "b12", label: "Vitamin B12", icon: "🧬",
    targetDaysPerWeek: 7,
    tip: "Add fortified plant milk or nutritional yeast daily — B12 has no reliable unfortified plant source.",
    sources: ["nutritional yeast", "soy milk", "oat milk", "almond milk", "plant milk", "fortified"],
  },
  {
    key: "iron", label: "Iron", icon: "🩸",
    targetDaysPerWeek: 7,
    tip: "Lentils, chickpeas, tofu, spinach and pumpkin seeds are strong plant iron sources — pair with vitamin C for absorption.",
    sources: ["lentil", "chickpea", "tofu", "tempeh", "spinach", "kale", "quinoa", "black bean", "cannellini", "edamame", "seitan", "pumpkin seed", "split pea", "bean"],
  },
  {
    key: "calcium", label: "Calcium", icon: "🦴",
    targetDaysPerWeek: 7,
    tip: "Calcium-set tofu, fortified plant milks, tahini and kale keep vegan calcium up.",
    sources: ["tofu", "soy milk", "oat milk", "almond", "kale", "tahini", "chia", "sesame", "fortified", "soy yogurt"],
  },
  {
    key: "zinc", label: "Zinc", icon: "⚙️",
    targetDaysPerWeek: 5,
    tip: "Oats, pumpkin seeds, chickpeas, tempeh and cashews are reliable zinc sources.",
    sources: ["oat", "pumpkin seed", "chickpea", "lentil", "quinoa", "hemp", "tempeh", "cashew", "seitan", "bean", "edamame"],
  },
  {
    key: "omega3", label: "Omega-3 (ALA)", icon: "🐟",
    targetDaysPerWeek: 5,
    tip: "A tablespoon of chia, flax or hemp seeds — or a handful of walnuts — covers plant omega-3.",
    sources: ["chia", "flax", "hemp", "walnut", "pine nut"],
  },
] as const;

export type GuardianNutrientKey = (typeof GUARDIAN_NUTRIENTS)[number]["key"];

const libraryIngredientText = new Map<string, string>(
  MEAL_LIBRARY.map(m => [m.name.toLowerCase(), `${m.name} ${m.ingredients.join(" ")}`.toLowerCase()])
);

/* Logged meals from the plan resolve to full ingredient text; custom foods
   fall back to their own name. */
function textForLoggedMeal(name: string): string {
  return libraryIngredientText.get(name.toLowerCase()) ?? name.toLowerCase();
}

export function nutrientsInText(text: string): GuardianNutrientKey[] {
  const t = text.toLowerCase();
  return GUARDIAN_NUTRIENTS.filter(n => n.sources.some(s => t.includes(s))).map(n => n.key);
}

export interface NutrientStatus {
  key: GuardianNutrientKey;
  label: string;
  icon: string;
  daysCovered: number;
  daysLogged: number;
  windowDays: number;
  targetDaysPerWeek: number;
  status: "ok" | "low" | "critical" | "no-data";
  tip: string;
}

export async function analyzeNutrientCoverage(userId: string, windowDays = 7): Promise<NutrientStatus[]> {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (windowDays - 1));

  const logs = await prisma.mealLog.findMany({
    where: { userId, status: "completed", slot: { not: "water" }, date: { gte: from } },
    select: { name: true, date: true }
  });

  const coveredByDay = new Map<string, Set<GuardianNutrientKey>>();
  for (const log of logs) {
    const dayKey = log.date.toISOString().slice(0, 10);
    if (!coveredByDay.has(dayKey)) coveredByDay.set(dayKey, new Set());
    const set = coveredByDay.get(dayKey)!;
    for (const n of nutrientsInText(textForLoggedMeal(log.name))) set.add(n);
  }
  const daysLogged = coveredByDay.size;

  return GUARDIAN_NUTRIENTS.map(n => {
    const daysCovered = [...coveredByDay.values()].filter(set => set.has(n.key)).length;
    const expected = Math.round((n.targetDaysPerWeek / 7) * Math.min(windowDays, Math.max(daysLogged, 1)));
    let status: NutrientStatus["status"];
    if (daysLogged === 0) status = "no-data";
    else if (daysCovered >= expected) status = "ok";
    else if (daysCovered >= Math.ceil(expected / 2)) status = "low";
    else status = "critical";
    return {
      key: n.key, label: n.label, icon: n.icon,
      daysCovered, daysLogged, windowDays,
      targetDaysPerWeek: n.targetDaysPerWeek,
      status, tip: n.tip
    };
  });
}
