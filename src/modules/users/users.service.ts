import { compare, hash } from "bcryptjs";
import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { resolveNotificationPrefs, type NotificationPrefs } from "../../shared/constants/settings.js";

// Single source of truth for what a user sees about themselves. passwordHash
// is selected only to derive hasPassword and is stripped by toOwnProfile().
const OWN_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  goal: true,
  goalLocked: true,
  onboardingDone: true,
  onboardingCompletedAt: true,
  streakCount: true,
  heightCm: true,
  weightKg: true,
  bodyFatPercent: true,
  age: true,
  gender: true,
  activityLevel: true,
  dietaryStyle: true,
  dietaryPreferences: true,
  calorieTargetOverride: true,
  proteinTargetOverride: true,
  hydrationTargetOverride: true,
  carbsTargetOverride: true,
  fatTargetOverride: true,
  goalTargetWeightKg: true,
  goalStartWeightKg: true,
  goalTargetBodyFatPercent: true,
  weeklyWorkoutTarget: true,
  goalTimelineWeeks: true,
  goalTargetDate: true,
  goalSetAt: true,
  unitPreference: true,
  language: true,
  notificationPrefs: true,
  role: true,
  gymTrainerId: true,
  approvedGymPlanJson: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
  gymTrainer: {
    select: {
      id: true,
      name: true,
      title: true,
      bio: true,
      imageUrl: true,
      linkedUserId: true,
      certifications: true,
      specializations: true,
      yearsExperience: true,
      workingHours: true,
      languages: true
    }
  }
} as const;

function toOwnProfile<T extends { passwordHash: string | null; notificationPrefs: unknown }>(user: T) {
  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    hasPassword: Boolean(passwordHash),
    notificationPrefs: resolveNotificationPrefs(user.notificationPrefs)
  };
}

export async function getPublicUserById(id: string) {
  return await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      goal: true,
      streakCount: true,
      gymTrainer: {
        select: {
          id: true,
          name: true,
          title: true,
          bio: true,
          imageUrl: true
        }
      }
    }
  });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: OWN_PROFILE_SELECT
  });
  return user ? toOwnProfile(user) : null;
}

export async function updateUserProfile(
  userId: string,
  input: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    age?: number | null;
    gender?: "FEMALE" | "MALE" | "OTHER";
    activityLevel?: "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "ATHLETE";
    goal?: "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE";
    dietaryStyle?: string;
    dietaryPreferences?: string[];
    bodyFatPercent?: number;
    unitPreference?: "METRIC" | "IMPERIAL";
    language?: string;
    notificationPrefs?: NotificationPrefs;
    goalTargetWeightKg?: number | null;
    goalTargetBodyFatPercent?: number | null;
    weeklyWorkoutTarget?: number | null;
    goalTargetDate?: Date | null;
    goalSetAt?: Date | null;
  }
) {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { goal: true, goalLocked: true }
  });
  if (!existing) throw new HttpError(404, "User not found");

  if (input.goal !== undefined) {
    if (existing.goalLocked && input.goal !== existing.goal) {
      throw new HttpError(400, "Goal is permanent and cannot be changed");
    }
  }

  const lockGoal =
    input.goal !== undefined && (input.goal === "FAT_LOSS" || input.goal === "MUSCLE_BUILD");

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name ?? undefined,
        email: input.email ?? undefined,
        image: input.image ?? undefined,
        heightCm: input.heightCm === undefined ? undefined : input.heightCm,
        weightKg: input.weightKg === undefined ? undefined : input.weightKg,
        age: input.age === undefined ? undefined : input.age,
        gender: input.gender === undefined ? undefined : input.gender,
        activityLevel: input.activityLevel === undefined ? undefined : input.activityLevel,
        goal: input.goal === undefined ? undefined : input.goal,
        dietaryStyle: input.dietaryStyle === undefined ? undefined : input.dietaryStyle,
        dietaryPreferences: input.dietaryPreferences === undefined ? undefined : input.dietaryPreferences,
        bodyFatPercent: input.bodyFatPercent === undefined ? undefined : input.bodyFatPercent,
        unitPreference: input.unitPreference === undefined ? undefined : input.unitPreference,
        language: input.language === undefined ? undefined : input.language,
        notificationPrefs: input.notificationPrefs === undefined ? undefined : input.notificationPrefs,
        goalTargetWeightKg: input.goalTargetWeightKg === undefined ? undefined : input.goalTargetWeightKg,
        goalTargetBodyFatPercent: input.goalTargetBodyFatPercent === undefined ? undefined : input.goalTargetBodyFatPercent,
        weeklyWorkoutTarget: input.weeklyWorkoutTarget === undefined ? undefined : input.weeklyWorkoutTarget,
        goalTargetDate: input.goalTargetDate === undefined ? undefined : input.goalTargetDate,
        goalSetAt: input.goalSetAt === undefined ? undefined : input.goalSetAt,
        ...(input.goal !== undefined ? { goalLocked: existing.goalLocked || Boolean(lockGoal) } : {})
      },
      select: OWN_PROFILE_SELECT
    });
    return toOwnProfile(updated);
  } catch (err: any) {
    if (err?.code === "P2002") throw new HttpError(400, "Email already in use");
    throw err;
  }
}

export async function changeUserPassword(
  userId: string,
  input: { currentPassword?: string; newPassword: string }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true }
  });
  if (!user) throw new HttpError(404, "User not found");

  if (user.passwordHash) {
    if (!input.currentPassword) throw new HttpError(400, "Current password is required");
    const valid = await compare(input.currentPassword, user.passwordHash);
    if (!valid) throw new HttpError(400, "Current password is incorrect");
    if (input.currentPassword === input.newPassword) {
      throw new HttpError(400, "New password must be different from the current one");
    }
  }
  // Google-only accounts (no passwordHash) may set their first password here.

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hash(input.newPassword, 10) }
  });
  return { ok: true };
}

export async function deleteUserAccount(userId: string, confirmEmail: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true }
  });
  if (!user) throw new HttpError(404, "User not found");
  if (user.role === "ADMIN") throw new HttpError(400, "Admin accounts cannot be deleted from the app");
  if (!user.email || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new HttpError(400, "Email confirmation does not match your account email");
  }

  // All user-owned relations cascade (or set-null) at the DB level.
  await prisma.user.delete({ where: { id: userId } });
  return { ok: true };
}

export async function getUserStats(userId: string) {
  const [user, workoutCount, postsCount, likesReceived] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { streakCount: true, createdAt: true }
    }),
    prisma.workoutLog.count({ where: { userId } }),
    prisma.post.count({ where: { userId } }),
    prisma.postLike.count({ where: { post: { userId } } }),
  ]);

  if (!user) return null;

  const msPerMonth = 1000 * 60 * 60 * 24 * 30;
  const monthsVegan = Math.max(0, Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / msPerMonth
  ));

  return { workoutCount, postsCount, likesReceived, streakCount: user.streakCount, monthsVegan };
}

export async function searchUsers(searchText: string, limit = 10) {
  const normalizedSearchText = searchText.trim();
  if (!normalizedSearchText) return [];
  const maxResults = Math.max(1, Math.min(20, limit));

  return await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: normalizedSearchText, mode: "insensitive" } },
        { email: { contains: normalizedSearchText, mode: "insensitive" } }
      ]
    },
    orderBy: { updatedAt: "desc" },
    take: maxResults,
    select: {
      id: true,
      name: true,
      email: true,
      image: true
    }
  });
}
