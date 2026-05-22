import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { requireObject, requireString } from "../../shared/validation/validators.js";
import { toggleFollow } from "./follow.service.js";

export async function postFollow(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const userId = requireString(body, "userId", { trim: true, min: 8 });
  if (userId === req.userId) return jsonOk(res, { error: "You cannot follow yourself" }, 400);

  const result = await toggleFollow(req.userId!, userId);
  return jsonOk(res, result.body, result.status);
}

