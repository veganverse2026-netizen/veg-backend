import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { getMe, getMeStats, getUser, getUsersSearch, patchMe } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/users/search", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getUsersSearch(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

usersRouter.get("/users/me/stats", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getMeStats(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

usersRouter.get("/users/me", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getMe(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

usersRouter.get("/users/:id", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getUser(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

usersRouter.patch("/users/me", requireUser, async (req: AuthedRequest, res) => {
  try {
    await patchMe(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
