import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { getTracker, postTracker } from "./tracker.controller.js";

export const trackerRouter = Router();

trackerRouter.get("/tracker", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getTracker(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

trackerRouter.post("/tracker", requireUser, asyncHandler(postTracker));
