import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma.js";
import { createNotification } from "../notifications/notifications.service.js";
import { HttpError } from "../../shared/errors/http-error.js";
function startOfDay(d) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
}
// Monday-start calendar week, matching the convention already used elsewhere
// in this codebase (DashTrackingClient.tsx's startOfWeek, cheat-meals.service.ts's
// weekStartDate) — deliberately NOT a rolling trailing-7-day window, which is
// what the old frontend-only volume calc used and is inconsistent with every
// other "this week" display in the app.
function startOfWeek(d) {
    const copy = startOfDay(d);
    const day = copy.getDay();
    const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
    copy.setDate(diff);
    return copy;
}
function dateKey(d) {
    return d.toISOString().slice(0, 10);
}
// Mirrors tracker.service.ts's addTrackerEntry, but run inside the SAME
// transaction as the workout-completion write so a completion and its
// streak/tracker side effects either both land or both roll back — no
// partial state if one step fails partway through.
async function markWorkoutCompletedForStreak(tx, userId) {
    const today = startOfDay(new Date());
    await tx.tracker.create({ data: { userId, workoutCompleted: true } });
    await tx.streak.upsert({
        where: { userId_date: { userId, date: today } },
        update: { completed: true },
        create: { userId, date: today, completed: true }
    });
    const allDates = await tx.streak.findMany({ where: { userId, completed: true }, select: { date: true } });
    const dateKeys = new Set(allDates.map((d) => dateKey(d.date)));
    let currentStreak = 0;
    const cursor = startOfDay(new Date());
    while (dateKeys.has(dateKey(cursor))) {
        currentStreak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }
    await tx.user.update({ where: { id: userId }, data: { streakCount: currentStreak } });
}
function computePrs(logs) {
    const byExercise = new Map();
    for (const log of logs.slice(0, 200)) {
        const key = log.exercise.trim().toLowerCase();
        const volume = log.sets * log.reps * log.weightKg;
        const current = byExercise.get(key);
        if (!current || log.weightKg > current.bestWeightKg || (log.weightKg === current.bestWeightKg && volume > current.bestVolume)) {
            byExercise.set(key, { exercise: log.exercise, bestWeightKg: log.weightKg, bestVolume: volume, updatedAt: log.performedAt });
        }
    }
    return Array.from(byExercise.values())
        .sort((a, b) => b.bestWeightKg - a.bestWeightKg)
        .slice(0, 8);
}
export async function listWorkoutLogsWithPrs(userId) {
    const logs = await prisma.workoutLog.findMany({
        where: { userId },
        orderBy: { performedAt: "desc" },
        take: 40
    });
    const prs = computePrs(logs);
    return { logs, prs };
}
/**
 * Real DB-level "best set per exercise, across the user's FULL history" query —
 * unlike listWorkoutLogsWithPrs's `prs` (derived in JS from only the most recent
 * 40 logs, capped at 8 results), this supports true pagination and can surface a
 * PR set months ago that fell outside that recent-40 window.
 */
export async function listPersonalRecordsPaginated(userId, page, limit, q) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;
    const search = q?.trim();
    // Applied at the SQL level (not just the current page in JS) so search still
    // matches records sitting on pages the client hasn't fetched yet.
    const searchFilter = search ? Prisma.sql `AND "exercise" ILIKE ${"%" + search + "%"}` : Prisma.empty;
    const [rows, countRows] = await Promise.all([
        prisma.$queryRaw `
      SELECT * FROM (
        SELECT DISTINCT ON (LOWER(TRIM(exercise)))
          exercise,
          "weightKg" AS "bestWeightKg",
          ("sets" * "reps" * "weightKg") AS "bestVolume",
          "performedAt" AS "updatedAt"
        FROM "WorkoutLog"
        WHERE "userId" = ${userId} ${searchFilter}
        ORDER BY LOWER(TRIM(exercise)), "weightKg" DESC, ("sets" * "reps" * "weightKg") DESC, "performedAt" DESC
      ) best
      ORDER BY "bestWeightKg" DESC
      LIMIT ${safeLimit} OFFSET ${offset}
    `,
        prisma.$queryRaw `
      SELECT COUNT(DISTINCT LOWER(TRIM(exercise))) AS count
      FROM "WorkoutLog"
      WHERE "userId" = ${userId} ${searchFilter}
    `
    ]);
    const total = Number(countRows[0]?.count ?? 0);
    const prs = rows.map((r) => ({
        exercise: r.exercise,
        bestWeightKg: Number(r.bestWeightKg),
        bestVolume: Number(r.bestVolume),
        updatedAt: r.updatedAt
    }));
    return { prs, total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) };
}
export async function createWorkoutLog(userId, input) {
    const created = await prisma.workoutLog.create({
        data: {
            userId,
            performedAt: input.performedAt,
            exercise: input.exercise,
            sets: input.sets,
            reps: input.reps,
            weightKg: input.weightKg,
            notes: input.notes?.trim() || null
        }
    });
    // Notify the member's trainer on their FIRST logged exercise of the day —
    // not every exercise, since a single workout is usually logged as several
    // separate calls (one per exercise) and would otherwise spam the trainer.
    const dayStart = startOfDay(input.performedAt);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    const logsToday = await prisma.workoutLog.count({
        where: { userId, performedAt: { gte: dayStart, lt: dayEnd } }
    });
    if (logsToday === 1) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, gymTrainerId: true } });
        if (user?.gymTrainerId) {
            const trainer = await prisma.gymTrainer.findUnique({ where: { id: user.gymTrainerId }, select: { linkedUserId: true } });
            if (trainer?.linkedUserId) {
                await createNotification({
                    userId: trainer.linkedUserId,
                    type: "GYM",
                    title: "Member completed a workout",
                    body: `${user.name ?? "A member"} logged today's workout.`,
                    link: "/dashboard/gym-trainer",
                });
            }
        }
    }
    const { logs, prs } = await listWorkoutLogsWithPrs(userId);
    return { success: true, log: created, logs, prs };
}
async function notifyTrainerOfCompletion(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, gymTrainerId: true } });
    if (!user?.gymTrainerId)
        return;
    const trainer = await prisma.gymTrainer.findUnique({ where: { id: user.gymTrainerId }, select: { linkedUserId: true } });
    if (!trainer?.linkedUserId)
        return;
    await createNotification({
        userId: trainer.linkedUserId,
        type: "GYM",
        title: "Member completed a workout",
        body: `${user.name ?? "A member"} logged today's workout.`,
        link: "/dashboard/gym-trainer"
    });
}
export async function getTodayWorkoutCompletion(userId) {
    const today = startOfDay(new Date());
    const completion = await prisma.workoutCompletion.findUnique({ where: { userId_date: { userId, date: today } } });
    return { completion };
}
/**
 * Atomic "Log Workout": creates one WorkoutCompletion (type LOGGED) plus a
 * WorkoutLog row per exercise, all in a single transaction — either the whole
 * session lands, or none of it does. The completion's unique (userId, date)
 * constraint is what actually prevents completing the same day twice; a
 * second call on the same day fails with P2002, translated to a 409 below.
 */
export async function logWorkoutSession(userId, exercises) {
    const today = startOfDay(new Date());
    const now = new Date();
    let completion;
    try {
        completion = await prisma.$transaction(async (tx) => {
            const created = await tx.workoutCompletion.create({
                data: { userId, date: today, type: "LOGGED", completedAt: now }
            });
            // A single createMany instead of one create() per exercise — fewer
            // round-trips inside the transaction, which matters because Prisma's
            // default 5s interactive-transaction timeout was getting hit on Neon
            // under real network latency once this transaction also had to do
            // the tracker/streak upsert chain below.
            if (exercises.length > 0) {
                await tx.workoutLog.createMany({
                    data: exercises.map((ex) => ({
                        userId,
                        performedAt: now,
                        exercise: ex.exercise,
                        sets: ex.sets,
                        reps: ex.reps,
                        weightKg: ex.weightKg,
                        notes: ex.notes?.trim() || null
                    }))
                });
            }
            await markWorkoutCompletedForStreak(tx, userId);
            return created;
        }, { timeout: 15000, maxWait: 10000 });
    }
    catch (err) {
        if (err?.code === "P2002")
            throw new HttpError(409, "Today's workout has already been completed");
        throw err;
    }
    // Side effect, not part of the atomic write — a notification failure
    // shouldn't roll back an otherwise-successful log.
    await notifyTrainerOfCompletion(userId);
    const { logs, prs } = await listWorkoutLogsWithPrs(userId);
    return { success: true, completion, logs, prs };
}
/** "Done": marks the day completed without creating any WorkoutLog rows — no fake sets/reps/weight. */
export async function markWorkoutDone(userId) {
    const today = startOfDay(new Date());
    const now = new Date();
    let completion;
    try {
        completion = await prisma.$transaction(async (tx) => {
            const created = await tx.workoutCompletion.create({
                data: { userId, date: today, type: "DONE", completedAt: now }
            });
            await markWorkoutCompletedForStreak(tx, userId);
            return created;
        }, { timeout: 15000, maxWait: 10000 });
    }
    catch (err) {
        if (err?.code === "P2002")
            throw new HttpError(409, "Today's workout has already been completed");
        throw err;
    }
    await notifyTrainerOfCompletion(userId);
    return { success: true, completion };
}
/**
 * Backend-authoritative "Volume Lifted This Week" — Monday-start calendar
 * week (not a rolling 7 days), queries every WorkoutLog in the window
 * directly (not capped at 40, unlike listWorkoutLogsWithPrs) so a busy week
 * can't silently lose volume once it has more than 40 sets logged. Rows with
 * weightKg = 0 (bodyweight/no-load exercises — there's no separate bodyweight
 * concept in this schema, see WorkoutLog.weightKg) are excluded explicitly
 * rather than relying on "anything times zero is zero," since a future
 * formula change could otherwise silently start counting them.
 */
export async function getWeeklyVolume(userId) {
    const weekStart = startOfWeek(new Date());
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
    const logs = await prisma.workoutLog.findMany({
        where: { userId, performedAt: { gte: weekStart, lt: weekEnd }, weightKg: { gt: 0 } },
        select: { sets: true, reps: true, weightKg: true, performedAt: true }
    });
    const totalVolumeKg = logs.reduce((sum, l) => sum + l.sets * l.reps * l.weightKg, 0);
    const workoutDaysThisWeek = new Set(logs.map((l) => dateKey(l.performedAt))).size;
    return { totalVolumeKg, workoutDaysThisWeek, weekStart, weekEnd };
}
