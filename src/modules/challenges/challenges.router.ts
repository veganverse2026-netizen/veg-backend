import { Router } from "express";
import { jsonError } from "../../shared/http/json-response.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import {
  getChallenge,
  getChallenges,
  postChallenge,
  postChallengeCheckIn,
  postChallengeJoin,
  postChallengeLeave
} from "./challenges.controller.js";

export const challengesRouter = Router();

challengesRouter.get("/challenges", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getChallenges(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

challengesRouter.get("/challenges/:id", requireUser, asyncHandler(getChallenge));

challengesRouter.post("/challenges", requireUser, asyncHandler(postChallenge));

challengesRouter.post("/challenges/:id/join", requireUser, asyncHandler(postChallengeJoin));

challengesRouter.post("/challenges/:id/leave", requireUser, asyncHandler(postChallengeLeave));

challengesRouter.post("/challenges/:id/checkin", requireUser, asyncHandler(postChallengeCheckIn));
