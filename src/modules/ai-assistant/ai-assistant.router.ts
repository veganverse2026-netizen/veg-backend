import { Router } from "express";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { aiChatLimiter } from "../../shared/middleware/rate-limit.middleware.js";
import { jsonError } from "../../shared/http/json-response.js";
import {
  getConversations,
  getConversationDetail,
  removeConversation,
  postChatMessage
} from "./ai-assistant.controller.js";

export const aiAssistantRouter = Router();

aiAssistantRouter.get("/ai-assistant/conversations", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getConversations(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

aiAssistantRouter.get("/ai-assistant/conversations/:id", requireUser, async (req: AuthedRequest, res) => {
  try {
    await getConversationDetail(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

aiAssistantRouter.delete("/ai-assistant/conversations/:id", requireUser, async (req: AuthedRequest, res) => {
  try {
    await removeConversation(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

aiAssistantRouter.post("/ai-assistant/chat", requireUser, aiChatLimiter, async (req: AuthedRequest, res) => {
  try {
    await postChatMessage(req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});
