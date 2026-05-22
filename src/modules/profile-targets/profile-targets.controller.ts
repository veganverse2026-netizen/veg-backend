import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { getProfileTargetsService, updateProfileTargetsService } from "./profile-targets.service.js";

export async function getProfileTargets(req: AuthedRequest, res: Response) {
  const data = await getProfileTargetsService(req.userId!);
  return jsonOk(res, data);
}

export async function postProfileTargets(req: AuthedRequest, res: Response) {
  const data = await updateProfileTargetsService(req.userId!, req.body);
  return jsonOk(res, data);
}

