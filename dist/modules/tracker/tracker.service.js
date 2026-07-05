import { prisma } from "../../infrastructure/db/prisma.js";
export async function listTrackers(userId) {
    return await prisma.tracker.findMany({
        where: { userId },
        orderBy: { date: "asc" },
        take: 14
    });
}
export async function addTrackerEntry(userId, input) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.tracker.create({
        data: {
            userId,
            weightKg: input.weightKg,
            caloriesConsumed: input.caloriesConsumed,
            proteinIntake: input.proteinIntake,
            workoutCompleted: input.workoutCompleted ?? false
        }
    });
    await prisma.streak.upsert({
        where: { userId_date: { userId, date: today } },
        update: { completed: true },
        create: { userId, date: today, completed: true }
    });
    const completed = await prisma.streak.count({ where: { userId, completed: true } });
    await prisma.user.update({ where: { id: userId }, data: { streakCount: completed } });
    return { success: true };
}
