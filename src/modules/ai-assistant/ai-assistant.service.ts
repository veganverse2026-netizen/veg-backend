import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { env } from "../../config/env.js";
import { computeTDEE, computeGoalCalorieTarget, computeMacroTargets, computeHydrationTarget, type GoalKind } from "../../shared/domain/calorieEngine.js";

const MODEL = env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const MAX_HISTORY_MESSAGES = 20;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, "The AI Assistant is not configured yet — ANTHROPIC_API_KEY is missing on the server.");
  }
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

const SUGGEST_MEAL_TOOL: Anthropic.Tool = {
  name: "suggest_meal",
  description:
    "Call this whenever you recommend a specific vegan meal or recipe, so the app can render it as a structured card with an 'Add to Meals' action. Only ever suggest 100% vegan meals.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Meal name" },
      ingredients: { type: "array", items: { type: "string" } },
      instructions: { type: "string", description: "Short preparation steps" },
      calories: { type: "number" },
      protein: { type: "number", description: "grams" },
      carbs: { type: "number", description: "grams" },
      fat: { type: "number", description: "grams" },
      allergyWarnings: { type: "array", items: { type: "string" }, description: "e.g. contains soy, contains nuts" }
    },
    required: ["name", "ingredients", "instructions", "calories", "protein", "carbs", "fat"]
  }
};

/**
 * Compact, strictly userId-scoped personalization context — never includes
 * any other user's data. Mirrors the same target-computation the rest of the
 * app already uses (calorieEngine + profile-targets overrides).
 */
async function buildUserContext(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      goal: true,
      weightKg: true,
      heightCm: true,
      age: true,
      gender: true,
      activityLevel: true,
      bodyFatPercent: true,
      dietaryStyle: true,
      dietaryPreferences: true,
      goalTargetWeightKg: true,
      goalTargetBodyFatPercent: true,
      weeklyWorkoutTarget: true,
      calorieTargetOverride: true,
      proteinTargetOverride: true,
      hydrationTargetOverride: true,
      unitPreference: true,
      gymTrainer: { select: { name: true } },
      mealPlanJson: true
    }
  });
  if (!user) throw new HttpError(404, "User not found");

  const lines: string[] = [];
  lines.push(`Name: ${user.name ?? "Member"}`);
  if (user.goal) lines.push(`Primary fitness goal: ${user.goal}`);
  if (user.weightKg) lines.push(`Current weight: ${user.weightKg}kg`);
  if (user.heightCm) lines.push(`Height: ${user.heightCm}cm`);
  if (user.age) lines.push(`Age: ${user.age}`);
  if (user.gender) lines.push(`Gender: ${user.gender}`);
  if (user.activityLevel) lines.push(`Activity level: ${user.activityLevel}`);
  if (user.bodyFatPercent) lines.push(`Body fat: ${user.bodyFatPercent}%`);
  if (user.dietaryStyle) lines.push(`Dietary style: ${user.dietaryStyle}`);
  if (user.dietaryPreferences?.length) lines.push(`Allergies / dietary tags to respect: ${user.dietaryPreferences.join(", ")}`);
  if (user.goalTargetWeightKg) lines.push(`Target weight: ${user.goalTargetWeightKg}kg`);
  if (user.goalTargetBodyFatPercent) lines.push(`Target body fat: ${user.goalTargetBodyFatPercent}%`);
  if (user.weeklyWorkoutTarget) lines.push(`Weekly workout target: ${user.weeklyWorkoutTarget} sessions/week`);
  if (user.gymTrainer?.name) lines.push(`Assigned trainer: ${user.gymTrainer.name} (do not claim to edit this user's trainer-approved plan — direct plan changes to the app's existing request flow)`);
  lines.push(`Unit preference: ${user.unitPreference}`);

  // Calorie/protein/hydration targets — profile overrides win, else computed the same way the rest of the app does.
  if (user.weightKg && user.heightCm && user.age && user.gender && user.activityLevel) {
    const genderKind = user.gender === "MALE" ? "MALE" : user.gender === "FEMALE" ? "FEMALE" : "OTHER";
    const tdee = computeTDEE({ weightKg: user.weightKg, heightCm: user.heightCm, age: user.age, gender: genderKind, activityLevel: user.activityLevel as any });
    const goalKind = (user.goal ?? "LIFESTYLE") as GoalKind;
    const calorieTarget = user.calorieTargetOverride ?? computeGoalCalorieTarget({ tdee, goal: goalKind, currentWeightKg: user.weightKg, targetWeightKg: user.goalTargetWeightKg ?? null, timelineWeeks: null });
    const macros = computeMacroTargets({ dailyCalorieTarget: calorieTarget, goal: goalKind, weightKg: user.weightKg });
    const proteinTarget = user.proteinTargetOverride ?? macros.proteinG;
    const hydrationTarget = user.hydrationTargetOverride ?? computeHydrationTarget(user.weightKg);
    lines.push(`Daily calorie goal: ${Math.round(calorieTarget)} kcal`);
    lines.push(`Daily protein goal: ${Math.round(proteinTarget)} g`);
    lines.push(`Daily water goal: ${Math.round(hydrationTarget)} ml`);
  }

  if (user.mealPlanJson) {
    try {
      const plan = JSON.parse(user.mealPlanJson);
      if (plan?.meta?.name) lines.push(`Current assigned meal plan: "${plan.meta.name}"`);
    } catch {
      /* ignore malformed plan JSON — not critical to the chat context */
    }
  }

  // Recent workout consistency (last 30 days) — real, not fabricated.
  const since = new Date(Date.now() - 30 * 86400000);
  const recentWorkouts = await prisma.workoutLog.findMany({ where: { userId, performedAt: { gte: since } }, select: { performedAt: true } });
  const distinctDays = new Set(recentWorkouts.map(w => w.performedAt.toISOString().slice(0, 10))).size;
  lines.push(`Workouts logged in the last 30 days: ${distinctDays} distinct days`);

  return lines.join("\n");
}

const SYSTEM_PROMPT_TEMPLATE = (userContext: string) => `You are VegaBot, this member's vegan nutrition coach — a conversational assistant inside the VeganFit app helping this one member with vegan meal planning, gym exercises, workout guidance, recovery, protein planning, progress interpretation, water and sleep habits, and general vegan fitness questions.

STRICT VEGAN-ONLY RULE: you must never recommend or suggest meat, fish, eggs, dairy, honey, or any other non-vegan ingredient, product, or supplement. Every food/meal/supplement suggestion must be 100% vegan. If asked for a non-vegan recommendation, politely decline and offer a vegan alternative instead.

SAFETY RULE: you are not a doctor and must never present yourself as one. Do not diagnose or prescribe treatment for any medical condition. For serious injuries, medical conditions, pregnancy, eating disorders, or severe symptoms, clearly tell the user to consult a qualified healthcare professional instead of advising further, and do not attempt to resolve the medical question yourself.

TRAINER RULE: this member may have a trainer-assigned workout or meal plan. Never claim to edit, replace, or override an assigned plan yourself — if they want to change it, tell them to use the app's existing plan-change-request flow (Gym Tracker / Meal Plans pages) so their trainer can review it.

SCOPE RULE: you only help with topics related to this app's features — vegan meals/recipes/nutrition, exercises, workouts, training programs, recovery, hydration, sleep, body-composition progress, and general vegan-fitness lifestyle questions. If the member asks about anything unrelated to vegan fitness/nutrition or this app (e.g. general trivia, coding help, news, entertainment, other diets, non-fitness personal advice), politely decline in one short sentence and redirect them to what you *can* help with — do not answer the off-topic question first and add a disclaimer after.

MEAL SUGGESTIONS: whenever you recommend a specific meal or recipe, call the suggest_meal tool with structured data (do not just describe it in prose) so the app can render it as a card with an "Add to Meals" button. Respect the member's allergies/dietary tags listed below — never suggest a meal containing something they need to avoid.

PRIVACY: only ever use this member's own data below. You have no access to and must never claim knowledge of any other user's data.

This member's data:
${userContext}

Keep replies concise, friendly, and actionable. Use the member's own unit preference (kg or lb, ml or oz) when giving numbers.`;

export async function listConversations(userId: string) {
  return prisma.aiChatConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, createdAt: true, updatedAt: true }
  });
}

export async function getConversationMessages(userId: string, conversationId: string) {
  const convo = await prisma.aiChatConversation.findFirst({ where: { id: conversationId, userId } });
  if (!convo) throw new HttpError(404, "Conversation not found");
  const messages = await prisma.aiChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" }
  });
  return { conversation: convo, messages: messages.map(formatMessage) };
}

function formatMessage(m: { id: string; role: string; content: string; suggestedMealJson: string | null; createdAt: Date }) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    suggestedMeal: m.suggestedMealJson ? JSON.parse(m.suggestedMealJson) : null,
    createdAt: m.createdAt
  };
}

export async function deleteConversation(userId: string, conversationId: string) {
  const convo = await prisma.aiChatConversation.findFirst({ where: { id: conversationId, userId } });
  if (!convo) throw new HttpError(404, "Conversation not found");
  await prisma.aiChatConversation.delete({ where: { id: conversationId } });
  return { ok: true };
}

export async function sendChatMessage(userId: string, input: { conversationId?: string; message: string }) {
  const message = input.message.trim();
  if (!message) throw new HttpError(400, "Message is required");
  if (message.length > 4000) throw new HttpError(400, "Message is too long");

  // Fail fast, before writing anything — an unconfigured API key must never
  // leave a dangling conversation/user-message row with no reply.
  const anthropic = getClient();

  let conversationId = input.conversationId;
  if (conversationId) {
    const owned = await prisma.aiChatConversation.findFirst({ where: { id: conversationId, userId } });
    if (!owned) throw new HttpError(404, "Conversation not found");
  } else {
    const created = await prisma.aiChatConversation.create({
      data: { userId, title: message.slice(0, 60) }
    });
    conversationId = created.id;
  }

  const priorMessages = await prisma.aiChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: MAX_HISTORY_MESSAGES
  });

  await prisma.aiChatMessage.create({ data: { conversationId, role: "user", content: message } });

  const userContext = await buildUserContext(userId);

  const history: Anthropic.MessageParam[] = priorMessages.map(m => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content
  }));
  history.push({ role: "user", content: message });

  let response;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT_TEMPLATE(userContext),
      tools: [SUGGEST_MEAL_TOOL],
      messages: history
    });
  } catch (err) {
    throw new HttpError(502, "The AI Assistant is temporarily unavailable. Please try again.");
  }

  let replyText = "";
  let suggestedMeal: unknown = null;
  for (const block of response.content) {
    if (block.type === "text") replyText += block.text;
    if (block.type === "tool_use" && block.name === "suggest_meal") suggestedMeal = block.input;
  }
  if (!replyText && suggestedMeal) replyText = "Here's a suggestion for you:";

  const saved = await prisma.aiChatMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: replyText || "I'm not sure how to respond to that — could you rephrase?",
      suggestedMealJson: suggestedMeal ? JSON.stringify(suggestedMeal) : null
    }
  });
  await prisma.aiChatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  return { conversationId, message: formatMessage(saved) };
}
