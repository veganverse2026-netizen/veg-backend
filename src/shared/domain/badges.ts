import { prisma } from "../../infrastructure/db/prisma.js";
import { analyzeNutrientCoverage } from "../../modules/meal-plans/meal-nutrients.js";

/**
 * Achievements — definitions live in code, not the database (mirrors the
 * Guardian pattern in meal-nutrients.ts). Every criterion below reads data
 * that already exists; nothing here requires new tracking infrastructure.
 * Deliberately celebratory, never punitive — there's no "you lost a badge"
 * concept, only earning.
 */
export const BADGE_DEFINITIONS = [
  { key: "streak_7", label: "7-Day Streak", icon: "🔥", description: "Logged something toward your goal 7 days in a row." },
  { key: "streak_30", label: "30-Day Streak", icon: "🔥", description: "A full month of consistency." },
  { key: "streak_100", label: "100-Day Streak", icon: "🏆", description: "100 days in a row — a real habit." },
  { key: "workout_1", label: "First Workout", icon: "💪", description: "Logged your very first workout." },
  { key: "workout_10", label: "10 Workouts Logged", icon: "💪", description: "Ten workouts in the books." },
  { key: "workout_50", label: "50 Workouts Logged", icon: "💪", description: "Fifty workouts — real dedication." },
  { key: "post_1", label: "First Post", icon: "📝", description: "Shared your first post with the community." },
  { key: "challenge_checkin_10", label: "10 Challenge Check-ins", icon: "🎯", description: "Checked into challenges ten times." },
  { key: "nutrient_guardian_week", label: "Nutrient Guardian", icon: "🛡️", description: "Covered every vegan-critical nutrient in one week." },
  { key: "referral_1", label: "Invited a Friend", icon: "🤝", description: "Brought a friend into VeganFit." },
  { key: "referral_5", label: "Community Builder", icon: "🤝", description: "Invited five friends." }
] as const;

export type BadgeKey = (typeof BADGE_DEFINITIONS)[number]["key"];

export interface BadgeStatus {
  key: BadgeKey;
  label: string;
  icon: string;
  description: string;
  earned: boolean;
  earnedAt?: string;
}

async function evaluateCriteria(userId: string): Promise<Set<BadgeKey>> {
  const [user, workoutCount, postCount, checkInCount, referralCount, nutrients] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { streakCount: true } }),
    prisma.workoutCompletion.count({ where: { userId } }),
    prisma.post.count({ where: { userId } }),
    prisma.challengeCheckIn.count({ where: { userId } }),
    prisma.user.count({ where: { referredById: userId } }),
    analyzeNutrientCoverage(userId, 7)
  ]);

  const qualified = new Set<BadgeKey>();
  if (user.streakCount >= 7) qualified.add("streak_7");
  if (user.streakCount >= 30) qualified.add("streak_30");
  if (user.streakCount >= 100) qualified.add("streak_100");
  if (workoutCount >= 1) qualified.add("workout_1");
  if (workoutCount >= 10) qualified.add("workout_10");
  if (workoutCount >= 50) qualified.add("workout_50");
  if (postCount >= 1) qualified.add("post_1");
  if (checkInCount >= 10) qualified.add("challenge_checkin_10");
  if (nutrients.length > 0 && nutrients.every((n) => n.status === "ok")) qualified.add("nutrient_guardian_week");
  if (referralCount >= 1) qualified.add("referral_1");
  if (referralCount >= 5) qualified.add("referral_5");
  return qualified;
}

/**
 * Evaluates every badge for a user, persists any newly-qualifying ones
 * (idempotent — already-earned badges are never re-awarded or revoked), and
 * returns both the full status list and just the newly-earned ones so a
 * caller triggered by a live user action can surface a celebration moment.
 */
export async function checkAndAwardBadges(userId: string): Promise<{ badges: BadgeStatus[]; newlyEarned: BadgeStatus[] }> {
  const [qualified, existing] = await Promise.all([
    evaluateCriteria(userId),
    prisma.userBadge.findMany({ where: { userId } })
  ]);

  const existingKeys = new Set(existing.map((b) => b.badgeKey));
  const toAward = [...qualified].filter((key) => !existingKeys.has(key));

  if (toAward.length > 0) {
    await prisma.userBadge.createMany({
      data: toAward.map((badgeKey) => ({ userId, badgeKey })),
      skipDuplicates: true
    });
  }

  const earnedAtByKey = new Map(existing.map((b) => [b.badgeKey, b.earnedAt]));
  const now = new Date();

  const badges: BadgeStatus[] = BADGE_DEFINITIONS.map((def) => {
    const earned = existingKeys.has(def.key) || toAward.includes(def.key);
    const earnedAt = earnedAtByKey.get(def.key) ?? (toAward.includes(def.key) ? now : undefined);
    return { ...def, earned, earnedAt: earnedAt?.toISOString() };
  });

  const newlyEarned = badges.filter((b) => toAward.includes(b.key));
  return { badges, newlyEarned };
}
