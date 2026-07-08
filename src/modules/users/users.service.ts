import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

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
  return await prisma.user.findUnique({
    where: { id },
    select: {
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
      role: true,
      gymTrainerId: true,
      approvedGymPlanJson: true,
      createdAt: true,
      updatedAt: true,
      gymTrainer: {
        select: {
          id: true,
          name: true,
          title: true,
          bio: true,
          imageUrl: true,
          linkedUserId: true
        }
      }
    }
  });
}

export async function updateUserProfile(
  userId: string,
  input: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    gymTrainerId?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    age?: number | null;
    gender?: "FEMALE" | "MALE" | "OTHER";
    activityLevel?: "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "ATHLETE";
    goal?: "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE";
    dietaryStyle?: string;
    dietaryPreferences?: string[];
    bodyFatPercent?: number;
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

  if (input.gymTrainerId !== undefined && input.gymTrainerId !== null) {
    const t = await prisma.gymTrainer.findUnique({ where: { id: input.gymTrainerId } });
    if (!t) throw new HttpError(400, "Invalid gym trainer");
  }

  const lockGoal =
    input.goal !== undefined && (input.goal === "FAT_LOSS" || input.goal === "MUSCLE_BUILD");

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name ?? undefined,
        email: input.email ?? undefined,
        image: input.image ?? undefined,
        gymTrainerId: input.gymTrainerId === undefined ? undefined : input.gymTrainerId,
        heightCm: input.heightCm === undefined ? undefined : input.heightCm,
        weightKg: input.weightKg === undefined ? undefined : input.weightKg,
        age: input.age === undefined ? undefined : input.age,
        gender: input.gender === undefined ? undefined : input.gender,
        activityLevel: input.activityLevel === undefined ? undefined : input.activityLevel,
        goal: input.goal === undefined ? undefined : input.goal,
        dietaryStyle: input.dietaryStyle === undefined ? undefined : input.dietaryStyle,
        dietaryPreferences: input.dietaryPreferences === undefined ? undefined : input.dietaryPreferences,
        bodyFatPercent: input.bodyFatPercent === undefined ? undefined : input.bodyFatPercent,
        ...(input.goal !== undefined ? { goalLocked: existing.goalLocked || Boolean(lockGoal) } : {})
      },
      select: {
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
        role: true,
        gymTrainerId: true,
        approvedGymPlanJson: true,
        createdAt: true,
        updatedAt: true,
        gymTrainer: {
          select: {
            id: true,
            name: true,
            title: true,
            bio: true,
            imageUrl: true,
            linkedUserId: true
          }
        }
      }
    });
  } catch (err: any) {
    if (err?.code === "P2002") throw new HttpError(400, "Email already in use");
    throw err;
  }
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

