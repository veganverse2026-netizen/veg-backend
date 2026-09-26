import type { Response, NextFunction } from "express";
import { HttpError } from "../errors/http-error.js";
import type { AuthedRequest } from "./auth.middleware.js";
import { requireUser } from "./auth.middleware.js";
import { requireRole } from "./role.middleware.js";

const requireAdminRole = requireRole("ADMIN");

// Composes requireUser + requireRole("ADMIN") so there's a single JWT
// verification/role-check implementation. Kept as its own export (rather than
// requiring every route to spell out `requireUser, requireRole("ADMIN")`)
// since it's also used standalone, without requireUser preceding it.
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.userId) {
    void requireAdminRole(req, res, next);
    return;
  }

  requireUser(req, res, (err?: unknown) => {
    if (err) return next(err instanceof Error ? err : new HttpError(401, "Unauthorized"));
    void requireAdminRole(req, res, next);
  });
}
