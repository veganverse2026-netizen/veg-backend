// User-facing settings vocabulary shared by users + notifications modules.

export const LANGUAGES = ["en", "hi", "es", "fr", "de"] as const;

export const UNIT_PREFERENCES = ["METRIC", "IMPERIAL"] as const;

// Per-user notification opt-outs. Types map 1:1 onto NotificationType except
// the two reminder flags, which gate the daily nudge crons specifically.
export type NotificationPrefs = {
  orderUpdates: boolean;
  community: boolean;
  gym: boolean;
  meals: boolean;
  system: boolean;
  workoutReminders: boolean;
  mealReminders: boolean;
};

export const NOTIFICATION_PREF_KEYS = [
  "orderUpdates",
  "community",
  "gym",
  "meals",
  "system",
  "workoutReminders",
  "mealReminders",
] as const;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  orderUpdates: true,
  community: true,
  gym: true,
  meals: true,
  system: true,
  workoutReminders: true,
  mealReminders: true,
};

// A user who has never touched the toggles has notificationPrefs = null.
export function resolveNotificationPrefs(stored: unknown): NotificationPrefs {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return { ...DEFAULT_NOTIFICATION_PREFS };
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const key of NOTIFICATION_PREF_KEYS) {
    const v = (stored as Record<string, unknown>)[key];
    if (typeof v === "boolean") prefs[key] = v;
  }
  return prefs;
}
