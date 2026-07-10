import { jsonOk } from "../../shared/http/json-response.js";
import { requireObject, requireString } from "../../shared/validation/validators.js";
import { deleteConversation, deleteMessage, getOrCreateConversation, getSupportContact, listInbox, listMessages, markConversationRead, sendMessage } from "./dm.service.js";
export async function getSupportContactHandler(_req, res) {
    const data = await getSupportContact();
    return jsonOk(res, data);
}
export async function getInbox(req, res) {
    const data = await listInbox(req.userId);
    return jsonOk(res, data);
}
export async function postConversation(req, res) {
    const body = requireObject(req.body);
    const targetUserId = requireString(body, "targetUserId", { trim: true, min: 8 });
    const convo = await getOrCreateConversation(req.userId, targetUserId);
    return jsonOk(res, convo, 201);
}
export async function getMessages(req, res) {
    const raw = req.query?.limit;
    const limit = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : 50;
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 50;
    const messages = await listMessages(req.userId, req.params.id, safeLimit);
    return jsonOk(res, messages);
}
export async function postMessage(req, res) {
    const body = requireObject(req.body);
    const content = requireString(body, "content", { trim: true, min: 1, max: 2000 });
    const msg = await sendMessage(req.userId, req.params.id, content);
    return jsonOk(res, msg, 201);
}
export async function postMarkRead(req, res) {
    const read = await markConversationRead(req.userId, req.params.id);
    return jsonOk(res, read);
}
export async function deleteConversationById(req, res) {
    const data = await deleteConversation(req.userId, req.params.id);
    return jsonOk(res, data);
}
export async function deleteMessageById(req, res) {
    const data = await deleteMessage(req.userId, req.params.id);
    return jsonOk(res, data);
}
