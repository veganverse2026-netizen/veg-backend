import { prisma } from "../../infrastructure/db/prisma.js";

// Same Oxford-research-based per-day figures used on the public homepage's
// ImpactSection (see that component's own comment for the same citation) —
// applied here per distinct day THIS user actually logged a completed meal,
// not a raw meal-item count (which could inflate the total if someone logs
// several snacks in one day), matching the day-based accounting the
// Nutrient Guardian already uses. A real personal stat, not the fabricated
// community-wide tally the homepage used to show before it was corrected.
const ANIMALS_SPARED_PER_DAY = 1;
const WATER_LITERS_SAVED_PER_DAY = 4164;
const CO2_KG_AVOIDED_PER_DAY = 9;

export interface UserImpactStats {
  daysLogged: number;
  animalsSpared: number;
  waterLitersSaved: number;
  co2KgAvoided: number;
}

export async function computeUserImpactStats(userId: string): Promise<UserImpactStats> {
  const logs = await prisma.mealLog.findMany({
    where: { userId, status: "completed", slot: { not: "water" } },
    select: { date: true }
  });

  const daysLogged = new Set(logs.map((l) => l.date.toISOString().slice(0, 10))).size;

  return {
    daysLogged,
    animalsSpared: Math.round(daysLogged * ANIMALS_SPARED_PER_DAY),
    waterLitersSaved: Math.round(daysLogged * WATER_LITERS_SAVED_PER_DAY),
    co2KgAvoided: Math.round(daysLogged * CO2_KG_AVOIDED_PER_DAY)
  };
}
