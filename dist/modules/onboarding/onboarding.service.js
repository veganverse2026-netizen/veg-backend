import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
export async function completeOnboarding(userId, input) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
        throw new HttpError(404, "User not found");
    if (user.goalLocked && input.goal !== user.goal) {
        throw new HttpError(400, "Goal is permanent and cannot be changed");
    }
    const lockGoal = input.goal === "FAT_LOSS" || input.goal === "MUSCLE_BUILD";
    // A target weight + timeline only makes sense for a goal that isn't
    // "maintain" — clear any previous timeline data if the user switches to
    // LIFESTYLE (only possible before the goal locks), so stale values can
    // never later influence meal-plan pacing.
    const hasTimelineInput = input.goalTargetWeightKg !== undefined && input.goalTimelineWeeks !== undefined;
    const goalTimelineData = lockGoal && hasTimelineInput
        ? {
            goalTargetWeightKg: input.goalTargetWeightKg,
            goalTimelineWeeks: input.goalTimelineWeeks,
            goalTargetDate: input.goalTargetDate ?? new Date(Date.now() + input.goalTimelineWeeks * 7 * 86400000),
            goalStartWeightKg: input.weightKg,
            goalSetAt: new Date()
        }
        : !lockGoal
            ? { goalTargetWeightKg: null, goalTimelineWeeks: null, goalTargetDate: null, goalStartWeightKg: null, goalSetAt: null }
            : {};
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
            ...goalTimelineData
        }
    });
    return { success: true };
}
