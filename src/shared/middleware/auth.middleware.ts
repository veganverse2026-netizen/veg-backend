import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors/http-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

export type AuthedRequest = Request & { userId?: string };

export function requireUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const auth = req.header("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;

  const userId =
    (bearer ? verifyAccessToken(bearer).sub : null) ??
    (req.header("x-user-id") ?? null);

  if (!userId) return next(new HttpError(401, "Unauthorized"));
  req.userId = userId;
  return next();
}
