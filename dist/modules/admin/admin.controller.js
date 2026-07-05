import { HttpError } from "../../shared/errors/http-error.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { optionalString, requireEnum, requireObject, requireString } from "../../shared/validation/validators.js";
import { createGymTrainerForAdmin, deleteGymTrainerForAdmin, getAdminOverview, getPlanRequestByIdForAdmin, getUserGymPlanForAdmin, listGymTrainersForAdmin, listPlanRequestsForAdmin, listUsersForAdmin, patchPlanRequestProposedSessionsForAdmin, patchUserGymPlanForAdmin, postUserGymPlanRowsForAdmin, updateGymTrainerForAdmin, updateUserRoleForAdmin } from "./admin.service.js";
const ROLE_VALUES = ["MEMBER", "GYM_TRAINER", "ADMIN"];
export async function getOverview(_req, res) {
    const data = await getAdminOverview();
    return jsonOk(res, data);
}
export async function getUsers(req, res) {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const data = await listUsersForAdmin({ page, limit, q });
    return jsonOk(res, data);
}
export async function patchUserRole(req, res) {
    const body = requireObject(req.body);
    const role = requireEnum(body, "role", ROLE_VALUES);
    const targetUserId = String(req.params.id ?? "").trim();
    if (targetUserId.length < 10)
        throw new HttpError(400, "Invalid id");
    const updated = await updateUserRoleForAdmin({
        adminUserId: req.userId,
        targetUserId,
        role
    });
    return jsonOk(res, updated);
}
export async function getGymTrainers(_req, res) {
    const rows = await listGymTrainersForAdmin();
    return jsonOk(res, rows);
}
export async function postGymTrainer(req, res) {
    const body = requireObject(req.body);
    const name = requireString(body, "name", { trim: true, min: 1, max: 160 });
    const title = optionalString(body, "title", { max: 200 });
    const bio = optionalString(body, "bio", { max: 4000 });
    const imageUrl = optionalString(body, "imageUrl", { max: 2000 });
    let sortOrder;
    if (body.sortOrder !== undefined && body.sortOrder !== null) {
        const n = Number(body.sortOrder);
        if (!Number.isFinite(n))
            throw new HttpError(400, "Invalid sortOrder");
        sortOrder = Math.floor(n);
    }
    let linkedUserId;
    if (body.linkedUserId === null) {
        linkedUserId = null;
    }
    else if (body.linkedUserId !== undefined) {
        linkedUserId = requireString(body, "linkedUserId", { trim: true, min: 10, max: 40 });
    }
    const created = await createGymTrainerForAdmin({
        name,
        title: title == null ? undefined : title,
        bio: bio == null ? undefined : bio,
        imageUrl: imageUrl == null ? undefined : imageUrl,
        sortOrder,
        linkedUserId
    });
    return jsonOk(res, created);
}
export async function patchGymTrainer(req, res) {
    const id = String(req.params.id ?? "").trim();
    if (id.length < 10)
        throw new HttpError(400, "Invalid id");
    const body = requireObject(req.body);
    const name = body.name !== undefined ? requireString(body, "name", { trim: true, min: 1, max: 160 }) : undefined;
    const title = body.title !== undefined ? optionalString(body, "title", { max: 200 }) : undefined;
    const bio = body.bio !== undefined ? optionalString(body, "bio", { max: 4000 }) : undefined;
    const imageUrl = body.imageUrl !== undefined ? optionalString(body, "imageUrl", { max: 2000 }) : undefined;
    let sortOrder;
    if (body.sortOrder !== undefined && body.sortOrder !== null) {
        const n = Number(body.sortOrder);
        if (!Number.isFinite(n))
            throw new HttpError(400, "Invalid sortOrder");
        sortOrder = Math.floor(n);
    }
    let linkedUserId;
    if (body.linkedUserId === null) {
        linkedUserId = null;
    }
    else if (body.linkedUserId !== undefined) {
        linkedUserId = requireString(body, "linkedUserId", { trim: true, min: 10, max: 40 });
    }
    const updated = await updateGymTrainerForAdmin(id, {
        ...(name !== undefined ? { name } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(linkedUserId !== undefined ? { linkedUserId } : {})
    });
    return jsonOk(res, updated);
}
export async function deleteGymTrainer(req, res) {
    const id = String(req.params.id ?? "").trim();
    if (id.length < 10)
        throw new HttpError(400, "Invalid id");
    const result = await deleteGymTrainerForAdmin(id);
    return jsonOk(res, result);
}
const PLAN_STATUS = ["PENDING", "APPROVED", "REJECTED"];
export async function getPlanRequests(req, res) {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const rawStatus = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "";
    const status = PLAN_STATUS.includes(rawStatus) ? rawStatus : undefined;
    const data = await listPlanRequestsForAdmin({ page, limit, status });
    return jsonOk(res, data);
}
export async function getPlanRequestById(req, res) {
    const id = String(req.params.id ?? "").trim();
    const data = await getPlanRequestByIdForAdmin(id);
    return jsonOk(res, data);
}
export async function patchPlanRequestSessions(req, res) {
    const id = String(req.params.id ?? "").trim();
    const body = requireObject(req.body);
    const proposedSessionsJson = requireString(body, "proposedSessionsJson", { min: 2, max: 500000 });
    const data = await patchPlanRequestProposedSessionsForAdmin({ requestId: id, proposedSessionsJson });
    return jsonOk(res, data);
}
export async function getUserGymPlan(req, res) {
    const userId = String(req.params.id ?? "").trim();
    const data = await getUserGymPlanForAdmin(userId);
    return jsonOk(res, data);
}
export async function patchUserGymPlan(req, res) {
    const userId = String(req.params.id ?? "").trim();
    const body = requireObject(req.body);
    const approvedGymPlanJson = requireString(body, "approvedGymPlanJson", { min: 2, max: 500000 });
    const data = await patchUserGymPlanForAdmin({ userId, approvedGymPlanJson });
    return jsonOk(res, data);
}
export async function postUserGymPlanRows(req, res) {
    const userId = String(req.params.id ?? "").trim();
    const body = requireObject(req.body);
    const rows = body.rows;
    if (!Array.isArray(rows))
        throw new HttpError(400, "rows must be an array");
    const data = await postUserGymPlanRowsForAdmin({ userId, rows });
    return jsonOk(res, data);
}
