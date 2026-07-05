import type { Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../errors/http-error.js";
import type { AuthedRequest } from "./auth.middleware.js";
import { verifyAccessToken } from "../utils/jwt.js";

function extractBearer(req: AuthedRequest): string | null {
  const auth = req.header("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

export async function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    // If requireUser hasn't run yet, extract and verify the token ourselves
    if (!req.userId) {
      const bearer = extractBearer(req);
      if (!bearer) return next(new HttpError(401, "Unauthorized"));
      try {
        const payload = verifyAccessToken(bearer);
        req.userId = payload.sub;
        req.userRole = payload.role;
      } catch {
        return next(new HttpError(401, "Unauthorized"));
      }
    }

    // Fast path: role already in JWT
    if (req.userRole === "ADMIN") return next();

    // Fallback: check DB (for tokens issued before role was added to JWT)
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });

    if (!user || user.role !== "ADMIN") {
      return next(new HttpError(403, "Admin access required"));
    }

    req.userRole = "ADMIN";
    return next();
  } catch (err) {
    return next(err instanceof Error ? err : new Error(String(err)));
  }
}
