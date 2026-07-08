import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

export async function completeOnboarding(
  userId: string,
  input: {
    heightCm: number;
    weightKg: number;
    age: number;
    gender: "FEMALE" | "MALE" | "OTHER";
    activityLevel: "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "ATHLETE";
    goal: "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE";
    dietaryStyle?: string;
    dietaryPreferences?: string[];
    bodyFatPercent?: number;
    gymTrainerId?: string | null;
  }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found");

  if (user.goalLocked && input.goal !== user.goal) {
    throw new HttpError(400, "Goal is permanent and cannot be changed");
  }

  let trainerConnect: { connect: { id: string } } | { disconnect: true } | undefined;
  if (input.gymTrainerId === null) {
    trainerConnect = { disconnect: true };
  } else if (input.gymTrainerId) {
    const t = await prisma.gymTrainer.findUnique({ where: { id: input.gymTrainerId } });
    if (!t) throw new HttpError(400, "Invalid gym trainer");
    trainerConnect = { connect: { id: input.gymTrainerId } };
  }

  const lockGoal = input.goal === "FAT_LOSS" || input.goal === "MUSCLE_BUILD";
  await prisma.user.update({
    where: { id: userId },
    data: {
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      age: input.age,
      gender: input.gender,
      activityLevel: input.activityLevel,
      goal: input.goal,
      goalLocked: user.goalLocked || lockGoal,
      onboardingDone: true,
      ...(user.onboardingCompletedAt ? {} : { onboardingCompletedAt: new Date() }),
      ...(input.dietaryStyle !== undefined ? { dietaryStyle: input.dietaryStyle } : {}),
      ...(input.dietaryPreferences !== undefined ? { dietaryPreferences: input.dietaryPreferences } : {}),
      ...(input.bodyFatPercent !== undefined ? { bodyFatPercent: input.bodyFatPercent } : {}),
      ...(trainerConnect ? { gymTrainer: trainerConnect } : {})
    }
  });

  return { success: true };
}

