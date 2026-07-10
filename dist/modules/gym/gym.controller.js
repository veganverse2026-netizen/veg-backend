import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { requireObject, optionalFreeStringArray, optionalNumber, optionalString, requireString } from "../../shared/validation/validators.js";
import { getMyTrainerProfile, listGymTrainers, updateMyTrainerProfile } from "./gym-trainers.service.js";
import { assignInitialPlan, createPlanChangeRequest, getLatestPlanRequestForMember, getMemberDetailForTrainer, listMyMembers, listPendingForTrainer, reviewPlanRequest } from "./workout-plan-requests.service.js";
import { createGymProgressPhoto, createMissedWorkoutReport, listGymProgressPhotos } from "./gym-member-extras.service.js";
export async function getGymTrainers(_req, res) {
    const trainers = await listGymTrainers();
    return jsonOk(res, trainers);
}
export async function postPlanChangeRequest(req, res) {
    const body = requireObject(req.body);
    const proposedSessionsJson = requireString(body, "proposedSessionsJson", { trim: false, min: 2 });
    const memberNote = optionalString(body, "memberNote", { max: 2000 });
    const created = await createPlanChangeRequest(req.userId, {
        memberNote: memberNote ?? null,
        proposedSessionsJson
    });
    return jsonOk(res, created, 201);
}
export async function getMyPlanRequest(req, res) {
    const latest = await getLatestPlanRequestForMember(req.userId);
    return jsonOk(res, latest);
}
export async function getTrainerPlanQueue(req, res) {
    const queue = await listPendingForTrainer(req.userId);
    return jsonOk(res, queue);
}
export async function postReviewPlanRequest(req, res) {
    const body = requireObject(req.body);
    const requestId = requireString(body, "requestId", { trim: true, min: 10 });
    const action = requireString(body, "action", { trim: true });
    if (action !== "approve" && action !== "reject") {
        throw new HttpError(400, "action must be approve or reject");
    }
    const trainerComment = optionalString(body, "trainerComment", { max: 2000 });
    const editedSessionsJson = optionalString(body, "editedSessionsJson", { trim: false });
    const updated = await reviewPlanRequest(req.userId, requestId, action, trainerComment ?? null, editedSessionsJson ?? null);
    return jsonOk(res, updated);
}
export async function getMyTrainerProfileHandler(req, res) {
    const profile = await getMyTrainerProfile(req.userId);
    return jsonOk(res, profile);
}
export async function patchMyTrainerProfile(req, res) {
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
    const updated = await updateMyTrainerProfile(req.userId, {
        ...(name !== undefined ? { name } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(bio !== undefined ? { bio } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(certifications !== undefined ? { certifications } : {}),
        ...(specializations !== undefined ? { specializations } : {}),
        ...(yearsExperience !== undefined ? { yearsExperience: yearsExperience == null ? null : Math.floor(yearsExperience) } : {}),
        ...(workingHours !== undefined ? { workingHours } : {}),
        ...(languages !== undefined ? { languages } : {}),
        ...(contactEmail !== undefined ? { contactEmail } : {}),
        ...(contactPhone !== undefined ? { contactPhone } : {})
    });
    return jsonOk(res, updated);
}
export async function getMyMembers(req, res) {
    const members = await listMyMembers(req.userId);
    return jsonOk(res, members);
}
export async function getMemberDetail(req, res) {
    const memberId = String(req.params.id ?? "").trim();
    if (memberId.length < 8)
        throw new HttpError(400, "Invalid id");
    const detail = await getMemberDetailForTrainer(req.userId, memberId);
    return jsonOk(res, detail);
}
export async function postAssignInitialPlan(req, res) {
    const body = requireObject(req.body);
    const memberId = requireString(body, "memberId", { trim: true, min: 8 });
    const proposedSessionsJson = requireString(body, "proposedSessionsJson", { trim: false, min: 2 });
    const updated = await assignInitialPlan(req.userId, memberId, proposedSessionsJson);
    return jsonOk(res, updated, 201);
}
export async function getGymProgressPhotos(req, res) {
    const rows = await listGymProgressPhotos(req.userId);
    return jsonOk(res, rows);
}
export async function postGymProgressPhoto(req, res) {
    const body = requireObject(req.body);
    const imageUrl = requireString(body, "imageUrl", { trim: true, min: 10 });
    const caption = optionalString(body, "caption", { max: 500 });
    const created = await createGymProgressPhoto(req.userId, { imageUrl, caption: caption ?? null });
    return jsonOk(res, created, 201);
}
export async function postMissedWorkout(req, res) {
    const body = requireObject(req.body);
    const reason = requireString(body, "reason", { trim: true, min: 8, max: 2000 });
    const out = await createMissedWorkoutReport(req.userId, reason);
    return jsonOk(res, out, 201);
}
