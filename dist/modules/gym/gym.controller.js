import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { requireObject, optionalString, requireString } from "../../shared/validation/validators.js";
import { prisma } from "../../infrastructure/db/prisma.js";
import { listGymTrainers } from "./gym-trainers.service.js";
import { createPlanChangeRequest, getLatestPlanRequestForMember, listPendingForTrainer, reviewPlanRequest } from "./workout-plan-requests.service.js";
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
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true }
    });
    if (user?.role !== "GYM_TRAINER") {
        throw new HttpError(403, "Trainer role required");
    }
    const queue = await listPendingForTrainer(req.userId);
    return jsonOk(res, queue);
}
export async function postReviewPlanRequest(req, res) {
    const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true }
    });
    if (user?.role !== "GYM_TRAINER") {
        throw new HttpError(403, "Trainer role required");
    }
    const body = requireObject(req.body);
    const requestId = requireString(body, "requestId", { trim: true, min: 10 });
    const action = requireString(body, "action", { trim: true });
    if (action !== "approve" && action !== "reject") {
        throw new HttpError(400, "action must be approve or reject");
    }
    const trainerComment = optionalString(body, "trainerComment", { max: 2000 });
    const updated = await reviewPlanRequest(req.userId, requestId, action, trainerComment ?? null);
    return jsonOk(res, updated);
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
