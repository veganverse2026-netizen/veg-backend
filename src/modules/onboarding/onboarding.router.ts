import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { postOnboarding } from "./onboarding.controller.js";

export const onboardingRouter = Router();

onboardingRouter.post("/onboarding", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postOnboarding(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
