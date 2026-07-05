import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { requireObject, requireString, optionalString } from "../../shared/validation/validators.js";
import {
  adminListWorkouts,
  adminCreateWorkout,
  adminUpdateWorkout,
  adminDeleteWorkout,
} from "./admin-workouts.service.js";

export async function getAdminWorkouts(req: AuthedRequest, res: Response) {
  const q = req.query as Record<string, string>;
  const workouts = await adminListWorkouts({ goal: q.goal, type: q.type });
  return jsonOk(res, workouts);
}

export async function postAdminWorkout(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const title = requireString(body, "title", { trim: true, min: 2, max: 200 });
  const description = requireString(body, "description", { trim: true, min: 2 });
  const type = requireString(body, "type", { trim: true }) as "HOME" | "GYM";
  const goal = requireString(body, "goal", { trim: true }) as "FAT_LOSS" | "MUSCLE_BUILD" | "LIFESTYLE";
  const durationMin = Number(body.durationMin);
  const level = requireString(body, "level", { trim: true, min: 1, max: 50 });
  const imageUrl = optionalString(body, "imageUrl", { max: 500 });
  const rating = body.rating != null ? Number(body.rating) : null;

  const workout = await adminCreateWorkout({ title, description, type, goal, durationMin, level, imageUrl, rating });
  return jsonOk(res, workout, 201);
}

export async function patchAdminWorkout(req: AuthedRequest, res: Response) {
  const { id } = req.params;
  const body = requireObject(req.body);
  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = requireString(body, "title", { trim: true, min: 2, max: 200 });
  if (body.description !== undefined) patch.description = requireString(body, "description", { trim: true, min: 2 });
  if (body.type !== undefined) patch.type = body.type;
  if (body.goal !== undefined) patch.goal = body.goal;
  if (body.durationMin !== undefined) patch.durationMin = Number(body.durationMin);
  if (body.level !== undefined) patch.level = String(body.level);
  if (body.imageUrl !== undefined) patch.imageUrl = body.imageUrl;
  if (body.rating !== undefined) patch.rating = body.rating != null ? Number(body.rating) : null;

  const updated = await adminUpdateWorkout(id, patch as any);
  return jsonOk(res, updated);
}

export async function deleteAdminWorkout(req: AuthedRequest, res: Response) {
  const { id } = req.params;
  const result = await adminDeleteWorkout(id);
  return jsonOk(res, result);
}
