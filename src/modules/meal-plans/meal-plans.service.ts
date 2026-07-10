import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { createNotification } from "../notifications/notifications.service.js";
import { generateRecommendations, computeCalorieTarget, type GeneratedMealPlan, type GeneratorContext } from "./meal-plan-generator.js";
import { analyzeNutrientCoverage } from "./meal-nutrients.js";

const USER_PROFILE_SELECT = {
  weightKg: true, heightCm: true, age: true, gender: true,
  activityLevel: true, goal: true, dietaryPreferences: true,
  calorieTargetOverride: true
} as const;

function parsePlan(json: string): GeneratedMealPlan {
  let parsed: any;
  try { parsed = JSON.parse(json); } catch { throw new HttpError(400, "Invalid plan JSON"); }
  if (!parsed || typeof parsed !== "object" || !parsed.meta || !Array.isArray(parsed.week) || parsed.week.length === 0) {
    throw new HttpError(400, "Plan must contain meta and a non-empty week");
  }
  return parsed as GeneratedMealPlan;
}

/**
 * Classify what a proposed plan changes vs the current one.
 * Exactly one differing meal (same day+slot) → MEAL_SWAP with that context;
 * anything else (several meals, different meta/plan) → FULL_PLAN.
 */
function classifyChange(current: GeneratedMealPlan, proposed: GeneratedMealPlan):
  | { type: "NONE" }
  | { type: "MEAL_SWAP"; context: { day: string; slot: string; currentMeal: unknown; proposedMeal: unknown } }
  | { type: "DAY_SWAP"; context: { day: string; currentMeals: unknown[]; proposedMeals: unknown[] } }
  | { type: "FULL_PLAN"; context: null } {
  if (current.meta?.id !== proposed.meta?.id || current.week.length !== proposed.week.length) {
    return { type: "FULL_PLAN", context: null };
  }
  const diffs: { day: string; slot: string; currentMeal: unknown; proposedMeal: unknown }[] = [];
  for (let d = 0; d < current.week.length; d++) {
    const curDay = current.week[d];
    const propDay = proposed.week[d];
    if (curDay.day !== propDay.day || (curDay.meals?.length ?? 0) !== (propDay.meals?.length ?? 0)) {
      return { type: "FULL_PLAN", context: null };
    }
    for (let m = 0; m < curDay.meals.length; m++) {
      if (JSON.stringify(curDay.meals[m]) !== JSON.stringify(propDay.meals[m])) {
        diffs.push({ day: curDay.day, slot: curDay.meals[m].slot, currentMeal: curDay.meals[m], proposedMeal: propDay.meals[m] });
      }
    }
  }
  if (diffs.length === 0) return { type: "NONE" };
  if (diffs.length === 1) return { type: "MEAL_SWAP", context: diffs[0] };
  const days = new Set(diffs.map((x) => x.day));
  if (days.size === 1) {
    const day = diffs[0].day;
    const curDay = current.week.find((x) => x.day === day)!;
    const propDay = proposed.week.find((x) => x.day === day)!;
    return { type: "DAY_SWAP", context: { day, currentMeals: curDay.meals, proposedMeals: propDay.meals } };
  }
  return { type: "FULL_PLAN", context: null };
}

async function ensureNoPendingRequest(userId: string) {
  const existing = await prisma.mealPlanChangeRequest.findFirst({ where: { userId, status: "PENDING" }, select: { id: true } });
  if (existing) throw new HttpError(409, "You already have a meal plan request awaiting trainer review");
}

const TYPE_LABEL: Record<string, { member: string; trainer: string; trainerBody: (name: string) => string }> = {
  MEAL_SWAP: {
    member: "Your meal replacement request is pending trainer review.",
    trainer: "Meal replacement to review",
    trainerBody: (n) => `${n} wants to replace one meal in their plan.`
  },
  DAY_SWAP: {
    member: "Your day-change request is pending trainer review.",
    trainer: "Day meal-change to review",
    trainerBody: (n) => `${n} wants a full day of meals replaced.`
  },
  FULL_PLAN: {
    member: "Your meal plan change request is pending trainer review.",
    trainer: "Meal plan change to review",
    trainerBody: (n) => `${n} wants to change their weekly meal plan.`
  }
};

async function createReviewRequest(
  user: { id: string; name: string | null; gymTrainerId: string },
  planJson: string,
  requestType: "FULL_PLAN" | "MEAL_SWAP" | "DAY_SWAP",
  context: unknown | null,
  memberNote?: string | null,
  reason?: string | null
) {
  await ensureNoPendingRequest(user.id);
  const request = await prisma.mealPlanChangeRequest.create({
    data: {
      userId: user.id,
      gymTrainerId: user.gymTrainerId,
      proposedPlanJson: planJson,
      requestType,
      reason: reason?.trim() || null,
      contextJson: context ? JSON.stringify(context) : null,
      memberNote: memberNote?.trim() || null
    }
  });

  const labels = TYPE_LABEL[requestType];
  await createNotification({
    userId: user.id,
    type: "GYM",
    title: "Request sent to your trainer 🟡",
    body: labels.member,
    link: "/dashboard/meal-plans",
  });

  const trainer = await prisma.gymTrainer.findUnique({ where: { id: user.gymTrainerId }, select: { linkedUserId: true } });
  if (trainer?.linkedUserId) {
    await createNotification({
      userId: trainer.linkedUserId,
      type: "GYM",
      title: labels.trainer,
      body: labels.trainerBody(user.name ?? "A member") + (reason ? ` Reason: ${reason}.` : ""),
      link: "/dashboard/gym-trainer",
    });
  }
  return request;
}

const DISLIKE_SKIP_THRESHOLD = 3;
const DISLIKE_WINDOW_DAYS = 30;

/** Adaptive plate: meals skipped ≥3× in the last 30 days count as disliked. */
export async function computeDislikedMeals(userId: string) {
  const from = new Date();
  from.setDate(from.getDate() - DISLIKE_WINDOW_DAYS);
  const skips = await prisma.mealLog.groupBy({
    by: ["name"],
    where: { userId, status: "skipped", date: { gte: from } },
    _count: { name: true }
  });
  return skips
    .filter(x => x._count.name >= DISLIKE_SKIP_THRESHOLD)
    .map(x => ({ name: x.name, skips: x._count.name }))
    .sort((a, b) => b.skips - a.skips);
}

async function generatorContextFor(userId: string): Promise<GeneratorContext> {
  const [user, disliked] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { approvedGymPlanJson: true } }),
    computeDislikedMeals(userId)
  ]);
  return { gymPlanJson: user?.approvedGymPlanJson ?? null, dislikedNames: disliked.map(d => d.name) };
}

export async function getRecommendations(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: USER_PROFILE_SELECT });
  if (!user) throw new HttpError(404, "User not found");
  return generateRecommendations(user, await generatorContextFor(userId));
}

export async function getNutrientGuardian(userId: string) {
  return analyzeNutrientCoverage(userId, 7);
}

export async function getMyMealPlan(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { mealPlanJson: true } });
  if (!user) throw new HttpError(404, "User not found");
  return user.mealPlanJson ? parsePlan(user.mealPlanJson) : null;
}

/**
 * Picking a plan from recommendations.
 * - First plan ever (nothing active): applies immediately; the trainer gets
 *   an FYI so they can adjust it.
 * - Switching away from an active plan with a trainer assigned: becomes a
 *   FULL_PLAN change request — nothing changes until the trainer approves.
 */
export async function selectMealPlan(userId: string, planJson: string, reason?: string | null) {
  const plan = parsePlan(planJson);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, mealPlanJson: true, gymTrainerId: true }
  });
  if (!user) throw new HttpError(404, "User not found");

  if (user.mealPlanJson && user.gymTrainerId) {
    const request = await createReviewRequest(
      { id: user.id, name: user.name, gymTrainerId: user.gymTrainerId },
      planJson,
      "FULL_PLAN",
      null,
      `Requested switch to "${plan.meta.name}"`,
      reason
    );
    return { applied: false as const, request };
  }

  await prisma.user.update({ where: { id: userId }, data: { mealPlanJson: planJson } });
  await createNotification({
    userId,
    type: "GYM",
    title: "Meal plan activated",
    body: `You're on "${plan.meta.name}" — ${plan.meta.dailyCalories} kcal/day. Time to eat well!`,
    link: "/dashboard/meal-plans",
  });
  if (user.gymTrainerId) {
    const trainer = await prisma.gymTrainer.findUnique({ where: { id: user.gymTrainerId }, select: { linkedUserId: true } });
    if (trainer?.linkedUserId) {
      await createNotification({
        userId: trainer.linkedUserId,
        type: "GYM",
        title: "Member started a meal plan",
        body: `${user.name ?? "A member"} started "${plan.meta.name}" (${plan.meta.dailyCalories} kcal/day). Review it from their workspace if it needs tuning.`,
        link: "/dashboard/gym-trainer",
      });
    }
  }
  return { applied: true as const, plan };
}

/**
 * Member proposes plan edits (meal replacement, custom meal, …).
 * With a trainer assigned NOTHING applies directly — the diff is classified
 * (single MEAL_SWAP vs FULL_PLAN) and goes to the trainer for approval.
 * Members without a trainer self-manage.
 */
export async function updateMyMealPlan(userId: string, planJson: string, memberNote?: string | null, reason?: string | null) {
  const proposed = parsePlan(planJson);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, mealPlanJson: true, gymTrainerId: true, name: true }
  });
  if (!user) throw new HttpError(404, "User not found");
  if (!user.mealPlanJson) throw new HttpError(400, "No active meal plan to update");

  const current = parsePlan(user.mealPlanJson);
  const change = classifyChange(current, proposed);
  if (change.type === "NONE") throw new HttpError(400, "The proposed plan is identical to your current plan");

  if (!user.gymTrainerId) {
    await prisma.user.update({ where: { id: userId }, data: { mealPlanJson: planJson } });
    return { applied: true as const, plan: proposed };
  }

  const request = await createReviewRequest(
    { id: user.id, name: user.name, gymTrainerId: user.gymTrainerId },
    planJson,
    change.type,
    change.type === "FULL_PLAN" ? null : change.context,
    memberNote,
    reason
  );
  return { applied: false as const, request };
}

/**
 * "Build it for me" requests — the member proposes nothing concrete and asks
 * the trainer to compose the replacement (whole plan or one day's meals).
 * proposedPlanJson carries the CURRENT plan; contextJson marks REGENERATE so
 * the trainer UI offers composition tools instead of a plain approve.
 */
export async function requestRegeneration(
  userId: string,
  input: { scope: "FULL_PLAN" | "DAY_SWAP" | "MEAL_SWAP"; day?: string | null; slot?: string | null; reason?: string | null; memberNote?: string | null }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, mealPlanJson: true, gymTrainerId: true }
  });
  if (!user) throw new HttpError(404, "User not found");
  if (!user.mealPlanJson) throw new HttpError(400, "No active meal plan");
  if (!user.gymTrainerId) throw new HttpError(400, "You need an assigned trainer for this — pick a plan directly instead");

  const current = parsePlan(user.mealPlanJson);
  let context: unknown;
  if (input.scope === "DAY_SWAP") {
    const day = current.week.find((d) => d.day === input.day);
    if (!day) throw new HttpError(400, "That day is not in your plan");
    context = { mode: "REGENERATE", day: day.day, currentMeals: day.meals };
  } else if (input.scope === "MEAL_SWAP") {
    const day = current.week.find((d) => d.day === input.day);
    if (!day) throw new HttpError(400, "That day is not in your plan");
    const meal = day.meals.find((m) => m.slot === input.slot);
    if (!meal) throw new HttpError(400, "That meal slot is not in your plan");
    context = { mode: "REGENERATE", day: day.day, slot: meal.slot, currentMeal: meal };
  } else {
    context = { mode: "REGENERATE" };
  }

  const request = await createReviewRequest(
    { id: user.id, name: user.name, gymTrainerId: user.gymTrainerId },
    user.mealPlanJson,
    input.scope,
    context,
    input.memberNote,
    input.reason
  );
  return { applied: false as const, request };
}

export async function getMyMealPlanRequest(userId: string) {
  return prisma.mealPlanChangeRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, requestType: true, reason: true, wasModified: true, memberNote: true, trainerComment: true, voiceNoteUrl: true, createdAt: true }
  });
}

/* ── Trainer side ── */

async function requireTrainerProfile(trainerUserId: string) {
  const profile = await prisma.gymTrainer.findFirst({ where: { linkedUserId: trainerUserId } });
  if (!profile) throw new HttpError(403, "No trainer profile is linked to this account");
  return profile;
}

export async function listMealRequestsForTrainer(trainerUserId: string) {
  const profile = await requireTrainerProfile(trainerUserId);
  // Includes the member's CURRENT plan so the review UI can show a
  // side-by-side comparison with nutritional deltas.
  return prisma.mealPlanChangeRequest.findMany({
    where: { gymTrainerId: profile.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true, mealPlanJson: true } } }
  });
}

/* Trainer opened a request for review — tell the member once per request. */
export async function markRequestInReview(trainerUserId: string, requestId: string) {
  const profile = await requireTrainerProfile(trainerUserId);
  const request = await prisma.mealPlanChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, "Request not found");
  if (request.gymTrainerId !== profile.id) throw new HttpError(403, "This request belongs to another trainer");
  if (request.status !== "PENDING") return { notified: false };

  const already = await prisma.notification.findFirst({
    where: { userId: request.userId, title: "Trainer is reviewing your request 👀", createdAt: { gte: request.createdAt } },
    select: { id: true }
  });
  if (already) return { notified: false };

  await createNotification({
    userId: request.userId,
    type: "GYM",
    title: "Trainer is reviewing your request 👀",
    body: "Your trainer opened your meal change request and is taking a look.",
    link: "/dashboard/meal-plans",
  });
  return { notified: true };
}

export async function reviewMealRequest(
  trainerUserId: string,
  requestId: string,
  action: "approve" | "reject",
  trainerComment?: string | null,
  editedPlanJson?: string | null,
  voiceNoteUrl?: string | null
) {
  const profile = await requireTrainerProfile(trainerUserId);
  const request = await prisma.mealPlanChangeRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError(404, "Request not found");
  if (request.gymTrainerId !== profile.id) throw new HttpError(403, "This request belongs to another trainer");
  if (request.status !== "PENDING") throw new HttpError(400, "Request is already reviewed");

  const now = new Date();
  const comment = trainerComment?.trim() || null;

  if (action === "reject") {
    const rejected = await prisma.mealPlanChangeRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", trainerComment: comment, voiceNoteUrl: voiceNoteUrl?.trim() || null, reviewedAt: now, reviewedByUserId: trainerUserId }
    });
    await createNotification({
      userId: request.userId,
      type: "GYM",
      title: "Meal change declined 🔴",
      body: comment ? `Your trainer declined the meal change: "${comment}"` : "Your trainer declined the meal change.",
      link: "/dashboard/meal-plans",
    });
    return rejected;
  }

  let finalJson = request.proposedPlanJson;
  let wasEdited = false;
  if (editedPlanJson?.trim()) {
    parsePlan(editedPlanJson);
    finalJson = editedPlanJson;
    wasEdited = finalJson !== request.proposedPlanJson;
  }

  await prisma.$transaction([
    prisma.mealPlanChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED", trainerComment: comment, voiceNoteUrl: voiceNoteUrl?.trim() || null, reviewedAt: now, reviewedByUserId: trainerUserId,
        wasModified: wasEdited,
        ...(wasEdited ? { proposedPlanJson: finalJson } : {})
      }
    }),
    prisma.user.update({ where: { id: request.userId }, data: { mealPlanJson: finalJson } })
  ]);

  await createNotification({
    userId: request.userId,
    type: "GYM",
    title: wasEdited ? "Request approved with trainer changes 🔵" : "Meal change approved 🟢",
    body: wasEdited
      ? "Your trainer approved your request but adjusted it — check your updated plan!"
      : "Your trainer approved your meal change. Enjoy!",
    link: "/dashboard/meal-plans",
  });
  return prisma.mealPlanChangeRequest.findUnique({ where: { id: requestId } });
}

export async function assignMealPlanToMember(trainerUserId: string, memberId: string, planJson: string) {
  const profile = await requireTrainerProfile(trainerUserId);
  const plan = parsePlan(planJson);
  const member = await prisma.user.findUnique({ where: { id: memberId }, select: { id: true, gymTrainerId: true } });
  if (!member || member.gymTrainerId !== profile.id) {
    throw new HttpError(403, "This member is not assigned to you");
  }
  await prisma.user.update({ where: { id: memberId }, data: { mealPlanJson: planJson } });

  // A direct assignment supersedes anything still waiting for review.
  await prisma.mealPlanChangeRequest.updateMany({
    where: { userId: memberId, status: "PENDING" },
    data: {
      status: "APPROVED", wasModified: true, reviewedAt: new Date(), reviewedByUserId: trainerUserId,
      trainerComment: "Superseded by a new plan your trainer assigned"
    }
  });

  await createNotification({
    userId: memberId,
    type: "GYM",
    title: "New meal plan from your trainer",
    body: `Your trainer set you up with "${plan.meta.name}" — ${plan.meta.dailyCalories} kcal/day.`,
    link: "/dashboard/meal-plans",
  });
  return plan;
}

export async function getMemberMealPlanForTrainer(trainerUserId: string, memberId: string) {
  const profile = await requireTrainerProfile(trainerUserId);
  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { id: true, gymTrainerId: true, mealPlanJson: true, ...USER_PROFILE_SELECT }
  });
  if (!member || member.gymTrainerId !== profile.id) {
    throw new HttpError(403, "This member is not assigned to you");
  }
  const [ctx, skippedMeals, nutrients, favorites] = await Promise.all([
    generatorContextFor(memberId),
    computeDislikedMeals(memberId),
    analyzeNutrientCoverage(memberId, 7),
    listFavoriteMeals(memberId)
  ]);
  return {
    plan: member.mealPlanJson ? parsePlan(member.mealPlanJson) : null,
    calorieTarget: computeCalorieTarget(member),
    recommendations: generateRecommendations(member, ctx),
    skippedMeals,
    nutrients,
    favorites
  };
}

/* ── Favorites ── */

export async function listFavoriteMeals(userId: string) {
  const rows = await prisma.favoriteMeal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map(r => {
    try { return { id: r.id, meal: JSON.parse(r.mealJson) }; } catch { return null; }
  }).filter(Boolean);
}

export async function saveFavoriteMeal(userId: string, mealJson: string) {
  let meal: any;
  try { meal = JSON.parse(mealJson); } catch { throw new HttpError(400, "Invalid meal JSON"); }
  if (!meal?.name) throw new HttpError(400, "Meal needs a name");
  const row = await prisma.favoriteMeal.create({ data: { userId, mealJson } });
  return { id: row.id, meal };
}

export async function deleteFavoriteMeal(userId: string, id: string) {
  const row = await prisma.favoriteMeal.findUnique({ where: { id }, select: { userId: true } });
  if (!row || row.userId !== userId) throw new HttpError(404, "Favorite not found");
  await prisma.favoriteMeal.delete({ where: { id } });
  return { deleted: true };
}
