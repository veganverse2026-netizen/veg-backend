import type { Response, NextFunction } from "express";
import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../errors/http-error.js";
import { verifyAccessToken } from "../utils/jwt.js";
import type { AuthedRequest } from "./auth.middleware.js";

export async function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.header("authorization") ?? "";
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;

    let userId: string | null = null;
    try {
      userId =
        (bearer ? verifyAccessToken(bearer).sub : null) ??
        (req.header("x-user-id") ?? null);
    } catch {
      return next(new HttpError(401, "Unauthorized"));
    }

    if (!userId) return next(new HttpError(401, "Unauthorized"));

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user || user.role !== "ADMIN") {
      return next(new HttpError(403, "Admin access required"));
    }

    req.userId = user.id;
    return next();
  } catch (err) {
    return next(err instanceof Error ? err : new Error(String(err)));
  }
}
