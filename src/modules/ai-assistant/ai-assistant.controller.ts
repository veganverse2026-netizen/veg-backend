import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { requireObject, requireString, optionalString } from "../../shared/validation/validators.js";
import {
  listConversations,
  getConversationMessages,
  deleteConversation,
  sendChatMessage
} from "./ai-assistant.service.js";

export async function getConversations(req: AuthedRequest, res: Response) {
  const result = await listConversations(req.userId!);
  return jsonOk(res, result);
}

export async function getConversationDetail(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!id) throw new HttpError(400, "id required");
  const result = await getConversationMessages(req.userId!, id);
  return jsonOk(res, result);
}

export async function removeConversation(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!id) throw new HttpError(400, "id required");
  const result = await deleteConversation(req.userId!, id);
  return jsonOk(res, result);
}

export async function postChatMessage(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const message = requireString(body, "message", { trim: true, min: 1, max: 4000 });
  const conversationId = optionalString(body, "conversationId", { trim: true, max: 40 });
  const result = await sendChatMessage(req.userId!, { conversationId, message });
  return jsonOk(res, result);
}
