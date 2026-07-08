import type { Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../errors/http-error.js";
import type { AuthedRequest } from "./auth.middleware.js";

// Generic role guard for use after `requireUser` — `requireAdmin` predates
// this and has its own bearer-extraction fallback; this one assumes
// `requireUser` already ran and set `req.userId`/`req.userRole`.
export function requireRole(role: string) {
  return async function (req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.userRole === role) return next();

      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { role: true }
      });

      if (!user || user.role !== role) {
        return next(new HttpError(403, `${role} role required`));
      }

      req.userRole = user.role;
      return next();
    } catch (err) {
      return next(err instanceof Error ? err : new Error(String(err)));
    }
  };
}
