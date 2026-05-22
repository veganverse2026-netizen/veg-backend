import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { postVegabot } from "./vegabot.controller.js";

export const vegabotRouter = Router();

// Minimal standalone version: returns a practical coach reply without depending on Next.js libs.
vegabotRouter.post("/vegabot", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postVegabot(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
