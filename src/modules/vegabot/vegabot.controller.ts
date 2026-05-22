import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { requireEnum, requireObject, requireString } from "../../shared/validation/validators.js";
import { generateOfflineReply } from "./vegabot.service.js";

export async function postVegabot(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const goal = requireEnum(body, "goal", ["FAT_LOSS", "MUSCLE_BUILD", "LIFESTYLE"] as const);
  const todayWorkout = requireString(body, "todayWorkout", { trim: true, min: 3, max: 2200 });
  const messages = Array.isArray((body as any).messages) ? (body as any).messages : [];
  const lastUser = [...messages].reverse().find((m: any) => m?.role === "user")?.content ?? "";

  const result = generateOfflineReply({ goal, lastUser });
  return jsonOk(res, { ...result, todayWorkout });
}

