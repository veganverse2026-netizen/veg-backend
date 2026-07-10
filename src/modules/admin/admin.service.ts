import type { PlanChangeStatus, UserRole } from "@prisma/client";
import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { createNotification } from "../notifications/notifications.service.js";

export async function getAdminOverview() {
  const [users, posts, recipes, gymTrainers, pendingPlanRequests, members, trainers] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.recipe.count(),
    prisma.gymTrainer.count(),
    prisma.workoutPlanChangeRequest.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "MEMBER" } }),
    prisma.user.count({ where: { role: "GYM_TRAINER" } })
  ]);

  return {
    users,
    posts,
    recipes,
    gymTrainers,
    pendingPlanRequests,
    members,
    trainers,
    admins: await prisma.user.count({ where: { role: "ADMIN" } })
  };
}

export async function listUsersForAdmin(input: {
  page: number;
  limit: number;
  q?: string;
}) {
  const limit = Math.min(50, Math.max(1, input.limit));
  const page = Math.max(1, input.page);
  const skip = (page - 1) * limit;

  const q = input.q?.trim();
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } }
        ]
      }
    : undefined;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        onboardingDone: true,
        createdAt: true,
        gymTrainerId: true
      }
    }),
    prisma.user.count({ where })
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

const ASSIGNABLE_ROLES: UserRole[] = ["MEMBER", "GYM_TRAINER", "ADMIN"];

export async function updateUserRoleForAdmin(input: {
  adminUserId: string;
  targetUserId: string;
  role: UserRole;
}) {
  if (!ASSIGNABLE_ROLES.includes(input.role)) {
    throw new HttpError(400, "Invalid role");
  }

  if (input.targetUserId === input.adminUserId) {
    throw new HttpError(400, "You cannot change your own role");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, role: true }
  });
  if (!target) throw new HttpError(404, "User not found");

  if (target.role === "ADMIN" && input.role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      throw new HttpError(400, "Cannot remove the last admin");
    }
  }

  return await prisma.user.update({
    where: { id: input.targetUserId },
    data: { role: input.role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      onboardingDone: true,
      createdAt: true,
      gymTrainerId: true
    }
  });
}

export async function assignUserGymTrainerForAdmin(input: { userId: string; trainerId: string | null }) {
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true } });
  if (!user) throw new HttpError(404, "User not found");

  if (input.trainerId === null) {
    return prisma.user.update({
      where: { id: input.userId },
      data: { gymTrainerId: null },
      select: { id: true, name: true, email: true, gymTrainerId: true }
    });
  }

  const trainer = await prisma.gymTrainer.findUnique({
    where: { id: input.trainerId },
    include: { _count: { select: { assignedUsers: true } } }
  });
  if (!trainer) throw new HttpError(400, "Trainer not found");
  if (!trainer.active) throw new HttpError(400, "This trainer is not active");

  const alreadyAssignedToThisTrainer = (await prisma.user.findUnique({ where: { id: input.userId }, select: { gymTrainerId: true } }))?.gymTrainerId === trainer.id;
  if (!alreadyAssignedToThisTrainer && trainer.maxUsers != null && trainer._count.assignedUsers >= trainer.maxUsers) {
    throw new HttpError(400, `${trainer.name} is at capacity (${trainer.maxUsers} members). Increase their limit or choose a different trainer.`);
  }

  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: { gymTrainerId: input.trainerId },
    select: { id: true, name: true, email: true, gymTrainerId: true }
  });

  await createNotification({
    userId: input.userId,
    type: "GYM",
    title: "Gym trainer assigned",
    body: `${trainer.name} is now your dedicated gym trainer and is preparing your personalized workout plan.`,
    link: "/dashboard/gym",
  });

  if (trainer.linkedUserId) {
    await createNotification({
      userId: trainer.linkedUserId,
      type: "GYM",
      title: "New member assigned",
      body: `${user.name ?? "A new member"} has been assigned to you. Review their profile and create a workout plan.`,
      link: "/dashboard/gym-trainer",
    });
  }

  return updated;
}

const GYM_TRAINER_ADMIN_SELECT = {
  id: true,
  name: true,
  title: true,
  bio: true,
  imageUrl: true,
  sortOrder: true,
  certifications: true,
  specializations: true,
  yearsExperience: true,
  workingHours: true,
  languages: true,
  contactEmail: true,
  contactPhone: true,
  active: true,
  approved: true,
  maxUsers: true,
  linkedUserId: true,
  _count: { select: { assignedUsers: true } }
} as const;

export async function listGymTrainersForAdmin() {
  return prisma.gymTrainer.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: GYM_TRAINER_ADMIN_SELECT
  });
}

// Linking a login account to a trainer profile implies that account IS a
// trainer — promote MEMBER accounts automatically so the admin doesn't have
// to remember the separate role step. ADMIN accounts are left untouched.
async function promoteLinkedUserToTrainer(linkedUserId: string) {
  await prisma.user.updateMany({
    where: { id: linkedUserId, role: "MEMBER" },
    data: { role: "GYM_TRAINER" }
  });
}

// Admin-created trainer login: makes a fresh GYM_TRAINER account the trainer
// signs into the admin panel with. Existing emails must be linked via the
// account picker instead, so we never silently take over someone's account.
async function createTrainerLoginAccount(name: string, email: string, password: string) {
  const normalized = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } });
  if (existing) {
    throw new HttpError(400, "A user with that email already exists — pick them in the account search instead");
  }
  const { hash } = await import("bcryptjs");
  return prisma.user.create({
    data: {
      email: normalized,
      name,
      role: "GYM_TRAINER",
      onboardingDone: true,
      passwordHash: await hash(password, 10)
    },
    select: { id: true }
  });
}

export async function createGymTrainerForAdmin(input: {
  name: string;
  title?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  certifications?: string | null;
  specializations?: string[];
  yearsExperience?: number | null;
  workingHours?: string | null;
  languages?: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  active?: boolean;
  maxUsers?: number | null;
  linkedUserId?: string | null;
  loginEmail?: string | null;
  loginPassword?: string | null;
}) {
  if (input.linkedUserId && input.loginEmail) {
    throw new HttpError(400, "Either link an existing account or create a new login — not both");
  }

  if (input.loginEmail && input.loginPassword) {
    const account = await createTrainerLoginAccount(input.name, input.loginEmail, input.loginPassword);
    input = { ...input, linkedUserId: account.id };
  }

  if (input.linkedUserId) {
    const u = await prisma.user.findUnique({ where: { id: input.linkedUserId }, select: { id: true } });
    if (!u) throw new HttpError(400, "Linked user not found");
    const clash = await prisma.gymTrainer.findUnique({ where: { linkedUserId: input.linkedUserId } });
    if (clash) throw new HttpError(400, "That user is already linked to a trainer profile");
    await promoteLinkedUserToTrainer(input.linkedUserId);
  }

  return prisma.gymTrainer.create({
    data: {
      name: input.name,
      title: input.title ?? null,
      bio: input.bio ?? null,
      imageUrl: input.imageUrl ?? null,
      sortOrder: input.sortOrder ?? 0,
      certifications: input.certifications ?? null,
      specializations: input.specializations ?? [],
      yearsExperience: input.yearsExperience ?? null,
      workingHours: input.workingHours ?? null,
      languages: input.languages ?? [],
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      active: input.active ?? true,
      maxUsers: input.maxUsers ?? null,
      linkedUserId: input.linkedUserId ?? null
    },
    select: GYM_TRAINER_ADMIN_SELECT
  });
}

export async function updateGymTrainerForAdmin(
  id: string,
  input: {
    name?: string;
    title?: string | null;
    bio?: string | null;
    imageUrl?: string | null;
    sortOrder?: number;
    certifications?: string | null;
    specializations?: string[];
    yearsExperience?: number | null;
    workingHours?: string | null;
    languages?: string[];
    contactEmail?: string | null;
    contactPhone?: string | null;
    active?: boolean;
    approved?: boolean;
    maxUsers?: number | null;
    linkedUserId?: string | null;
    loginEmail?: string | null;
    loginPassword?: string | null;
  }
) {
  const existing = await prisma.gymTrainer.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Trainer not found");

  if (input.loginEmail && input.loginPassword) {
    if (input.linkedUserId) {
      throw new HttpError(400, "Either link an existing account or create a new login — not both");
    }
    if (existing.linkedUserId) {
      throw new HttpError(400, "This trainer already has a login account — unlink it first");
    }
    const account = await createTrainerLoginAccount(input.name ?? existing.name, input.loginEmail, input.loginPassword);
    input = { ...input, linkedUserId: account.id };
  }

  if (input.linkedUserId !== undefined && input.linkedUserId !== null) {
    const u = await prisma.user.findUnique({ where: { id: input.linkedUserId }, select: { id: true } });
    if (!u) throw new HttpError(400, "Linked user not found");
    const clash = await prisma.gymTrainer.findFirst({
      where: { linkedUserId: input.linkedUserId, NOT: { id } }
    });
    if (clash) throw new HttpError(400, "That user is already linked to another trainer profile");
    await promoteLinkedUserToTrainer(input.linkedUserId);
  }

  const wasApproved = existing.approved;

  const updated = await prisma.gymTrainer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.certifications !== undefined ? { certifications: input.certifications } : {}),
      ...(input.specializations !== undefined ? { specializations: input.specializations } : {}),
      ...(input.yearsExperience !== undefined ? { yearsExperience: input.yearsExperience } : {}),
      ...(input.workingHours !== undefined ? { workingHours: input.workingHours } : {}),
      ...(input.languages !== undefined ? { languages: input.languages } : {}),
      ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.approved !== undefined ? { approved: input.approved } : {}),
      ...(input.maxUsers !== undefined ? { maxUsers: input.maxUsers } : {}),
      ...(input.linkedUserId !== undefined ? { linkedUserId: input.linkedUserId } : {})
    },
    select: GYM_TRAINER_ADMIN_SELECT
  });

  if (input.approved === true && !wasApproved && updated.linkedUserId) {
    await createNotification({
      userId: updated.linkedUserId,
      type: "GYM",
      title: "You're approved!",
      body: "Your trainer profile has been approved. You're now active and can be assigned members.",
      link: "/dashboard/gym-trainer",
    });
  }

  return updated;
}

export async function deleteGymTrainerForAdmin(id: string) {
  const t = await prisma.gymTrainer.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { assignedUsers: true, planRequests: true } }
    }
  });
  if (!t) throw new HttpError(404, "Trainer not found");
  if (t._count.assignedUsers > 0 || t._count.planRequests > 0) {
    throw new HttpError(400, "Cannot delete trainer with assigned members or existing plan requests");
  }
  await prisma.gymTrainer.delete({ where: { id } });
  return { ok: true as const };
}

export async function getGymTrainerDetailForAdmin(id: string) {
  const trainer = await prisma.gymTrainer.findUnique({
    where: { id },
    select: {
      ...GYM_TRAINER_ADMIN_SELECT,
      assignedUsers: {
        select: { id: true, name: true, email: true, goal: true, approvedGymPlanJson: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      },
      planRequests: {
        select: { id: true, status: true, createdAt: true, reviewedAt: true },
        orderBy: { createdAt: "desc" },
        take: 50
      }
    }
  });
  if (!trainer) throw new HttpError(404, "Trainer not found");

  const reviewed = trainer.planRequests.filter((r) => r.reviewedAt);
  const avgTurnaroundHours = reviewed.length
    ? reviewed.reduce((sum, r) => sum + (new Date(r.reviewedAt!).getTime() - new Date(r.createdAt).getTime()), 0) / reviewed.length / 3600000
    : null;

  return {
    ...trainer,
    stats: {
      totalRequests: trainer.planRequests.length,
      pendingRequests: trainer.planRequests.filter((r) => r.status === "PENDING").length,
      approvedRequests: trainer.planRequests.filter((r) => r.status === "APPROVED").length,
      rejectedRequests: trainer.planRequests.filter((r) => r.status === "REJECTED").length,
      avgTurnaroundHours: avgTurnaroundHours != null ? Math.round(avgTurnaroundHours * 10) / 10 : null
    }
  };
}

export async function listPlanRequestsForAdmin(input: {
  page: number;
  limit: number;
  status?: PlanChangeStatus;
}) {
  const limit = Math.min(50, Math.max(1, input.limit));
  const page = Math.max(1, input.page);
  const skip = (page - 1) * limit;
  const where = input.status ? { status: input.status } : undefined;

  const [items, total] = await Promise.all([
    prisma.workoutPlanChangeRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        status: true,
        memberNote: true,
        trainerComment: true,
        createdAt: true,
        reviewedAt: true,
        proposedSessionsJson: true,
        user: { select: { id: true, name: true, email: true } },
        gymTrainer: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.workoutPlanChangeRequest.count({ where })
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

export function validateGymSessionsJsonPayload(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new HttpError(400, "Must be a non-empty JSON array of gym sessions");
  }
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown> | null;
    if (!item || typeof item !== "object" || typeof item.day !== "string" || !Array.isArray(item.exercises)) {
      throw new HttpError(400, `Invalid session at index ${i} (need day: string and exercises: array)`);
    }
  }
}

export async function getPlanRequestByIdForAdmin(requestId: string) {
  if (requestId.length < 10) throw new HttpError(400, "Invalid request id");
  const row = await prisma.workoutPlanChangeRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      memberNote: true,
      trainerComment: true,
      createdAt: true,
      reviewedAt: true,
      proposedSessionsJson: true,
      user: { select: { id: true, name: true, email: true } },
      gymTrainer: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true, email: true } }
    }
  });
  if (!row) throw new HttpError(404, "Plan request not found");
  return row;
}

export async function patchPlanRequestProposedSessionsForAdmin(input: { requestId: string; proposedSessionsJson: string }) {
  validateGymSessionsJsonPayload(input.proposedSessionsJson);
  const existing = await prisma.workoutPlanChangeRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, status: true }
  });
  if (!existing) throw new HttpError(404, "Plan request not found");
  if (existing.status !== "PENDING") {
    throw new HttpError(400, "Only PENDING plan requests can be edited here. Use the member gym plan page for live approved programs.");
  }
  return prisma.workoutPlanChangeRequest.update({
    where: { id: input.requestId },
    data: { proposedSessionsJson: input.proposedSessionsJson },
    select: {
      id: true,
      status: true,
      proposedSessionsJson: true,
      updatedAt: true
    }
  });
}

export async function getUserGymPlanForAdmin(userId: string) {
  if (userId.length < 10) throw new HttpError(400, "Invalid user id");
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, approvedGymPlanJson: true }
  });
  if (!u) throw new HttpError(404, "User not found");
  return u;
}

export async function patchUserGymPlanForAdmin(input: { userId: string; approvedGymPlanJson: string }) {
  validateGymSessionsJsonPayload(input.approvedGymPlanJson);
  const u = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!u) throw new HttpError(404, "User not found");
  return prisma.user.update({
    where: { id: input.userId },
    data: { approvedGymPlanJson: input.approvedGymPlanJson },
    select: { id: true, name: true, email: true, approvedGymPlanJson: true, updatedAt: true }
  });
}

export type AdminGymPlanRowInput = {
  day?: string | null;
  title?: string | null;
  exercise?: string | null;
  sets?: string | null;
  reps?: string | null;
  load?: string | null;
  rest?: string | null;
  formCues?: string | null;
};

function strCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

/** Map weekday label to 0=Sun … 6=Sat; null if unknown (app still parses `day` text). */
function preferredWeekdayFromDayLabel(day: string): number | null {
  const n = day
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const full: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  if (full[n] !== undefined) return full[n];
  const short: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6
  };
  if (short[n] !== undefined) return short[n];
  return null;
}

/**
 * Flat admin rows (day, title, exercise, …) → gym session array stored as approvedGymPlanJson.
 * Empty `day` / `title` inherit the previous non-empty row (spreadsheet-style blocks).
 */
export function adminGymRowsToSessionsJson(rows: AdminGymPlanRowInput[]): string {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpError(400, "rows must be a non-empty array");
  }

  let lastDay = "";
  let lastTitle = "";
  type Chunk = { day: string; title: string; exercises: { name: string; sets: string; reps: string; load: string; rest: string; formCues?: string }[] };
  const chunks: Chunk[] = [];
  let cur: Chunk | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as Record<string, unknown> | null;
    if (!row || typeof row !== "object") {
      throw new HttpError(400, `rows[${i}] must be an object`);
    }

    const dayRaw = strCell(row.day);
    const titleRaw = strCell(row.title);
    const exercise = strCell(row.exercise);
    const sets = strCell(row.sets);
    const reps = strCell(row.reps);
    const load = strCell(row.load);
    const rest = strCell(row.rest);
    const formCuesRaw = strCell(row.formCues);

    const day = dayRaw || lastDay;
    const title = titleRaw || lastTitle;
    if (day) lastDay = day;
    if (title) lastTitle = title;

    if (!exercise) continue;

    if (!day || !title) {
      throw new HttpError(400, `rows[${i}]: need day and title on the first row (or inherited from a previous row)`);
    }

    const key = `${day}|${title}`;
    const curKey = cur ? `${cur.day}|${cur.title}` : null;
    if (!cur || curKey !== key) {
      cur = { day, title, exercises: [] };
      chunks.push(cur);
    }

    cur.exercises.push({
      name: exercise,
      sets,
      reps,
      load,
      rest,
      ...(formCuesRaw ? { formCues: formCuesRaw } : {})
    });
  }

  if (chunks.length === 0) {
    throw new HttpError(400, "No exercise rows found — each saved row needs at least an exercise name");
  }

  const sessions = chunks.map((c) => {
    const preferredWeekday = preferredWeekdayFromDayLabel(c.day);
    return {
      day: c.day,
      focus: c.title,
      objective: "",
      title: c.title,
      subtitle: "",
      preferredWeekday,
      exercises: c.exercises
    };
  });

  const json = JSON.stringify(sessions);
  validateGymSessionsJsonPayload(json);
  return json;
}

export async function postUserGymPlanRowsForAdmin(input: { userId: string; rows: AdminGymPlanRowInput[] }) {
  const approvedGymPlanJson = adminGymRowsToSessionsJson(input.rows);
  return patchUserGymPlanForAdmin({ userId: input.userId, approvedGymPlanJson });
}
