export const DIETARY_STYLES = [
  "whole-foods",
  "raw",
  "hclf",
  "balanced",
  "high-protein-vegan",
  "low-carb-vegan",
  "athlete-performance",
  "weight-loss",
  "muscle-gain",
  "gluten-free-vegan",
  "soy-free-vegan",
  "nut-free-vegan",
  "high-fiber-vegan",
  "heart-healthy",
  "anti-inflammatory",
  "trainer-choice"
] as const;

// Selecting this defers the member's meal-plan approach to their assigned
// trainer instead of a self-picked style — the trainer portal surfaces it
// distinctly so it isn't mistaken for a real dietary choice.
export const TRAINER_CHOICE_DIETARY_STYLE = "trainer-choice";

export const DIETARY_PREFERENCES = [
  "soy-free",
  "gluten-free",
  "nut-free",
  "high-protein",
  "low-carb",
  "whole-food-pbwf",
  "none"
] as const;

// Selecting "none" is mutually exclusive with every other dietary preference
// tag — enforced client-side. It's a valid, meaningful value (explicit "no
// allergies/restrictions"), distinct from an empty array (not yet answered).
export const NO_DIETARY_PREFERENCES_ID = "none";

// Defense-in-depth against a client that (via bug or direct API call) sends
// "none" alongside real preferences — specific selections win, since they
// carry more information than a blanket "no restrictions" claim.
export function normalizeDietaryPreferences<T extends string[] | undefined>(prefs: T): T {
  if (prefs === undefined || prefs.length <= 1) return prefs;
  return prefs.filter((p) => p !== NO_DIETARY_PREFERENCES_ID) as T;
}
