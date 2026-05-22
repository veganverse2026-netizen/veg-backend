import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError } from "../../shared/http/json-response.js";
import { postFollow } from "./follow.controller.js";

export const followRouter = Router();

followRouter.post("/follow", requireUser, async (req: AuthedRequest, res) => {
  try {
    await postFollow(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
