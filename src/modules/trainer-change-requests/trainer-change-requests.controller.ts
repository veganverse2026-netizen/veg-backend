import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { requireObject, requireString, optionalString, requireEnum } from "../../shared/validation/validators.js";
import {
  createTrainerChangeRequest,
  getMyTrainerChangeRequest,
  listTrainerChangeRequestsForAdmin,
  reviewTrainerChangeRequest
} from "./trainer-change-requests.service.js";

export async function postTrainerChangeRequest(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const reason = requireString(body, "reason", { trim: true, min: 2, max: 200 });
  const description = optionalString(body, "description", { trim: true, max: 1000 });
  const preferredRequirements = optionalString(body, "preferredRequirements", { trim: true, max: 500 });
  const result = await createTrainerChangeRequest(req.userId!, {
    reason,
    description: description ?? null,
    preferredRequirements: preferredRequirements ?? null
  });
  return jsonOk(res, result, 201);
}

export async function getMyTrainerChangeRequestRoute(req: AuthedRequest, res: Response) {
  const result = await getMyTrainerChangeRequest(req.userId!);
  return jsonOk(res, result);
}

export async function getTrainerChangeRequestsForAdmin(req: AuthedRequest, res: Response) {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const result = await listTrainerChangeRequestsForAdmin({ page, limit, status });
  return jsonOk(res, result);
}

export async function postReviewTrainerChangeRequest(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const status = requireEnum(body, "status", ["APPROVED", "REJECTED", "COMPLETED"] as const);
  const adminComment = optionalString(body, "adminComment", { trim: true, max: 500 });
  const newTrainerId = optionalString(body, "newTrainerId", { trim: true, max: 40 });
  if (status === "COMPLETED" && !newTrainerId) throw new HttpError(400, "newTrainerId is required to complete this request");
  const id = String(req.params.id ?? "").trim();
  if (!id) throw new HttpError(400, "id required");
  const result = await reviewTrainerChangeRequest(id, {
    status,
    adminComment: adminComment ?? null,
    newTrainerId: newTrainerId ?? null
  });
  return jsonOk(res, result);
}
