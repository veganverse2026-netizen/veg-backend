import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../errors/http-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

export type AuthedRequest = Request & { userId?: string; userRole?: string };

function extractBearer(req: Request): string | null {
  const auth = req.header("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const cookieHeader = req.header("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)vf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function optionalUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const bearer = extractBearer(req);
  if (bearer) {
    try {
      const payload = verifyAccessToken(bearer);
      req.userId = payload.sub;
      req.userRole = payload.role;
    } catch {
      // silently ignore invalid token for optional auth
    }
  }
  return next();
}

export function requireUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const bearer = extractBearer(req);
  if (!bearer) return next(new HttpError(401, "Unauthorized"));

  try {
    const payload = verifyAccessToken(bearer);
    req.userId = payload.sub;
    req.userRole = payload.role;
    return next();
  } catch {
    return next(new HttpError(401, "Unauthorized"));
  }
}
