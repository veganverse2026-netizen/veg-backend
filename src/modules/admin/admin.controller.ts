import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { jsonOk } from "../../shared/http/json-response.js";
import {
  optionalBoolean,
  optionalFreeStringArray,
  optionalNumber,
  optionalString,
  requireEnum,
  requireObject,
  requireString
} from "../../shared/validation/validators.js";
import {
  assignUserGymTrainerForAdmin,
  createGymTrainerForAdmin,
  deleteGymTrainerForAdmin,
  getAdminOverview,
  getGymTrainerDetailForAdmin,
  getPlanRequestByIdForAdmin,
  getUserGymPlanForAdmin,
  listGymTrainersForAdmin,
  listPlanRequestsForAdmin,
  listUsersForAdmin,
  patchPlanRequestProposedSessionsForAdmin,
  patchUserGymPlanForAdmin,
  postUserGymPlanRowsForAdmin,
  updateGymTrainerForAdmin,
  updateUserRoleForAdmin
} from "./admin.service.js";
import { adminReviewPlanRequest } from "../gym/workout-plan-requests.service.js";

const ROLE_VALUES = ["MEMBER", "GYM_TRAINER", "ADMIN"] as const;

export async function getOverview(_req: AuthedRequest, res: Response) {
  const data = await getAdminOverview();
  return jsonOk(res, data);
}

export async function getUsers(req: AuthedRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const q = typeof req.query.q === "string" ? req.query.q : undefined;

  const data = await listUsersForAdmin({ page, limit, q });
  return jsonOk(res, data);
}

export async function patchUserRole(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const role = requireEnum(body, "role", ROLE_VALUES);
  const targetUserId = String(req.params.id ?? "").trim();
  if (targetUserId.length < 10) throw new HttpError(400, "Invalid id");

  const updated = await updateUserRoleForAdmin({
    adminUserId: req.userId!,
    targetUserId,
    role
  });
  return jsonOk(res, updated);
}

export async function patchUserGymTrainer(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const targetUserId = String(req.params.id ?? "").trim();
  if (targetUserId.length < 10) throw new HttpError(400, "Invalid id");

  let trainerId: string | null;
  if (body.trainerId === null) {
    trainerId = null;
  } else {
    trainerId = requireString(body, "trainerId", { trim: true, min: 8 });
  }

  const updated = await assignUserGymTrainerForAdmin({ userId: targetUserId, trainerId });
  return jsonOk(res, updated);
}

export async function getGymTrainers(_req: AuthedRequest, res: Response) {
  const rows = await listGymTrainersForAdmin();
  return jsonOk(res, rows);
}

export async function getGymTrainerDetail(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (id.length < 8) throw new HttpError(400, "Invalid id");
  const detail = await getGymTrainerDetailForAdmin(id);
  return jsonOk(res, detail);
}

export async function postGymTrainer(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const name = requireString(body, "name", { trim: true, min: 1, max: 160 });
  const title = optionalString(body, "title", { max: 200 });
  const bio = optionalString(body, "bio", { max: 4000 });
  const imageUrl = optionalString(body, "imageUrl", { max: 2000 });
  const certifications = optionalString(body, "certifications", { max: 2000 });
  const specializations = optionalFreeStringArray(body, "specializations");
  const yearsExperience = optionalNumber(body, "yearsExperience");
  const workingHours = optionalString(body, "workingHours", { max: 500 });
  const languages = optionalFreeStringArray(body, "languages");
  const contactEmail = optionalString(body, "contactEmail", { max: 200 });
  const contactPhone = optionalString(body, "contactPhone", { max: 60 });
  const active = optionalBoolean(body, "active");
  const maxUsers = optionalNumber(body, "maxUsers");

  let sortOrder: number | undefined;
  if (body.sortOrder !== undefined && body.sortOrder !== null) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) throw new HttpError(400, "Invalid sortOrder");
    sortOrder = Math.floor(n);
  }

  let linkedUserId: string | null | undefined;
  if (body.linkedUserId === null) {
    linkedUserId = null;
  } else if (body.linkedUserId !== undefined) {
    linkedUserId = requireString(body, "linkedUserId", { trim: true, min: 10, max: 40 });
  }

  // Optional admin-created login credentials for the trainer account
  const loginEmail = optionalString(body, "loginEmail", { trim: true, max: 200 });
  const loginPassword = optionalString(body, "loginPassword", { trim: false, max: 200 });
  if ((loginEmail == null) !== (loginPassword == null)) {
    throw new HttpError(400, "Provide both login email and password, or neither");
  }
  if (loginEmail != null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
    throw new HttpError(400, "Invalid login email");
  }
  if (loginPassword != null && loginPassword.length < 8) {
    throw new HttpError(400, "Login password must be at least 8 characters");
  }

  const created = await createGymTrainerForAdmin({
    name,
    title: title == null ? undefined : title,
    bio: bio == null ? undefined : bio,
    imageUrl: imageUrl == null ? undefined : imageUrl,
    sortOrder,
    certifications: certifications == null ? undefined : certifications,
    specializations,
    yearsExperience: yearsExperience == null ? undefined : Math.floor(yearsExperience),
    workingHours: workingHours == null ? undefined : workingHours,
    languages,
    contactEmail: contactEmail == null ? undefined : contactEmail,
    contactPhone: contactPhone == null ? undefined : contactPhone,
    active,
    maxUsers: maxUsers == null ? undefined : Math.floor(maxUsers),
    linkedUserId,
    loginEmail,
    loginPassword
  });
  return jsonOk(res, created);
}

export async function patchGymTrainer(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (id.length < 10) throw new HttpError(400, "Invalid id");

  const body = requireObject(req.body);
  const name = body.name !== undefined ? requireString(body, "name", { trim: true, min: 1, max: 160 }) : undefined;
  const title = body.title !== undefined ? optionalString(body, "title", { max: 200 }) : undefined;
  const bio = body.bio !== undefined ? optionalString(body, "bio", { max: 4000 }) : undefined;
  const imageUrl = body.imageUrl !== undefined ? optionalString(body, "imageUrl", { max: 2000 }) : undefined;
  const certifications = body.certifications !== undefined ? optionalString(body, "certifications", { max: 2000 }) : undefined;
  const specializations = optionalFreeStringArray(body, "specializations");
  const yearsExperience = body.yearsExperience !== undefined ? optionalNumber(body, "yearsExperience") : undefined;
  const workingHours = body.workingHours !== undefined ? optionalString(body, "workingHours", { max: 500 }) : undefined;
  const languages = optionalFreeStringArray(body, "languages");
  const contactEmail = body.contactEmail !== undefined ? optionalString(body, "contactEmail", { max: 200 }) : undefined;
  const contactPhone = body.contactPhone !== undefined ? optionalString(body, "contactPhone", { max: 60 }) : undefined;
  const active = optionalBoolean(body, "active");
  const approved = optionalBoolean(body, "approved");

  let sortOrder: number | undefined;
  if (body.sortOrder !== undefined && body.sortOrder !== null) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) throw new HttpError(400, "Invalid sortOrder");
    sortOrder = Math.floor(n);
  }

  let maxUsers: number | null | undefined;
  if (body.maxUsers === null) {
    maxUsers = null;
  } else if (body.maxUsers !== undefined) {
    const n = Number(body.maxUsers);
    if (!Number.isFinite(n) || n < 0) throw new HttpError(400, "Invalid maxUsers");
    maxUsers = Math.floor(n);
  }

  let linkedUserId: string | null | undefined;
  if (body.linkedUserId === null) {
    linkedUserId = null;
  } else if (body.linkedUserId !== undefined) {
    linkedUserId = requireString(body, "linkedUserId", { trim: true, min: 10, max: 40 });
  }

  // Optional admin-created login credentials for the trainer account
  const loginEmail = optionalString(body, "loginEmail", { trim: true, max: 200 });
  const loginPassword = optionalString(body, "loginPassword", { trim: false, max: 200 });
  if ((loginEmail == null) !== (loginPassword == null)) {
    throw new HttpError(400, "Provide both login email and password, or neither");
  }
  if (loginEmail != null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)) {
    throw new HttpError(400, "Invalid login email");
  }
  if (loginPassword != null && loginPassword.length < 8) {
    throw new HttpError(400, "Login password must be at least 8 characters");
  }

  const updated = await updateGymTrainerForAdmin(id, {
    ...(name !== undefined ? { name } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(bio !== undefined ? { bio } : {}),
    ...(imageUrl !== undefined ? { imageUrl } : {}),
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    ...(certifications !== undefined ? { certifications } : {}),
    ...(specializations !== undefined ? { specializations } : {}),
    ...(yearsExperience !== undefined ? { yearsExperience: yearsExperience == null ? null : Math.floor(yearsExperience) } : {}),
    ...(workingHours !== undefined ? { workingHours } : {}),
    ...(languages !== undefined ? { languages } : {}),
    ...(maxUsers !== undefined ? { maxUsers } : {}),
    ...(contactEmail !== undefined ? { contactEmail } : {}),
    ...(contactPhone !== undefined ? { contactPhone } : {}),
    ...(active !== undefined ? { active } : {}),
    ...(approved !== undefined ? { approved } : {}),
    ...(linkedUserId !== undefined ? { linkedUserId } : {}),
    ...(loginEmail != null ? { loginEmail } : {}),
    ...(loginPassword != null ? { loginPassword } : {})
  });
  return jsonOk(res, updated);
}

export async function deleteGymTrainer(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (id.length < 10) throw new HttpError(400, "Invalid id");
  const result = await deleteGymTrainerForAdmin(id);
  return jsonOk(res, result);
}

const PLAN_STATUS = ["PENDING", "APPROVED", "REJECTED"] as const;

export async function getPlanRequests(req: AuthedRequest, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const rawStatus = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
  const status = PLAN_STATUS.includes(rawStatus as any) ? (rawStatus as (typeof PLAN_STATUS)[number]) : undefined;

  const data = await listPlanRequestsForAdmin({ page, limit, status });
  return jsonOk(res, data);
}

export async function getPlanRequestById(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  const data = await getPlanRequestByIdForAdmin(id);
  return jsonOk(res, data);
}

export async function patchPlanRequestSessions(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  const body = requireObject(req.body);
  const proposedSessionsJson = requireString(body, "proposedSessionsJson", { min: 2, max: 500000 });
  const data = await patchPlanRequestProposedSessionsForAdmin({ requestId: id, proposedSessionsJson });
  return jsonOk(res, data);
}

export async function postPlanRequestReview(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  const body = requireObject(req.body);
  const action = requireEnum(body, "action", ["approve", "reject"] as const);
  const comment = optionalString(body, "comment", { max: 2000 });
  const editedSessionsJson = optionalString(body, "editedSessionsJson", { trim: false, max: 500000 });
  const data = await adminReviewPlanRequest(req.userId!, id, action, comment, editedSessionsJson);
  return jsonOk(res, data);
}

export async function getUserGymPlan(req: AuthedRequest, res: Response) {
  const userId = String(req.params.id ?? "").trim();
  const data = await getUserGymPlanForAdmin(userId);
  return jsonOk(res, data);
}

export async function patchUserGymPlan(req: AuthedRequest, res: Response) {
  const userId = String(req.params.id ?? "").trim();
  const body = requireObject(req.body);
  const approvedGymPlanJson = requireString(body, "approvedGymPlanJson", { min: 2, max: 500000 });
  const data = await patchUserGymPlanForAdmin({ userId, approvedGymPlanJson });
  return jsonOk(res, data);
}

export async function postUserGymPlanRows(req: AuthedRequest, res: Response) {
  const userId = String(req.params.id ?? "").trim();
  const body = requireObject(req.body);
  const rows = body.rows;
  if (!Array.isArray(rows)) throw new HttpError(400, "rows must be an array");
  const data = await postUserGymPlanRowsForAdmin({ userId, rows });
  return jsonOk(res, data);
}
