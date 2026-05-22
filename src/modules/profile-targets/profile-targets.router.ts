import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { getProfileTargets, postProfileTargets } from "./profile-targets.controller.js";

export const profileTargetsRouter = Router();

profileTargetsRouter.get("/profile/targets", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getProfileTargets(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

profileTargetsRouter.post("/profile/targets", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postProfileTargets(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
