import { Router } from "express";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { optionalUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { prisma } from "../../infrastructure/db/prisma.js";

const MAX_STEP = 100;

function clampStep(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(MAX_STEP, Math.floor(num)));
}

// Authenticated users are keyed by their verified JWT subject, never by a
// client-supplied header — otherwise any caller could read/overwrite any
// other user's progress by guessing their id. Anonymous/pre-login visitors
// are tracked by an opaque client-generated journey id instead.
function getKey(req: AuthedRequest): string | null {
  if (req.userId) return `user:${req.userId}`;
  const journeyId = req.header("x-journey-id")?.trim() || null;
  if (journeyId) return `anon:${journeyId}`;
  return null;
}

export const journeyRouter = Router();

journeyRouter.get("/journey-step", optionalUser, async (req: AuthedRequest, res) => {
  try {
    const key = getKey(req);
    if (!key) return jsonOk(res, { step: 0 }, 200);

    const record = await prisma.journeyProgress.findUnique({ where: { key } });
    return jsonOk(res, { step: clampStep(record?.step ?? 0) }, 200);
  } catch (err) {
    return jsonError(res, err);
  }
});

journeyRouter.post("/journey-step", optionalUser, async (req: AuthedRequest, res) => {
  try {
    const key = getKey(req);
    if (!key) return jsonOk(res, { step: 0 }, 200);

    const step = clampStep((req.body as any)?.step);
    await prisma.journeyProgress.upsert({
      where: { key },
      create: { key, step },
      update: { step }
    });
    return jsonOk(res, { step }, 200);
  } catch (err) {
    return jsonError(res, err);
  }
});
