import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { requireUser } from "../../shared/middleware/auth.middleware.js";
import { optionalString, requireEnum, requireObject, requireString } from "../../shared/validation/validators.js";
import { addComment, createPost, getFeed, toggleLike, acceptAnswer, reportPost } from "./posts.service.js";
export async function getPostsFeed(_req, res) {
    const posts = await getFeed();
    return jsonOk(res, posts);
}
export const requireUserMiddleware = requireUser;
export async function postCreate(req, res) {
    const body = requireObject(req.body);
    const content = requireString(body, "content", { trim: true, min: 1, max: 2200 });
    const recipeLink = optionalString(body, "recipeLink", { trim: true, max: 500 }) ?? null;
    const type = requireEnum(body, "type", ["QUESTION", "WIN", "MEAL_IDEA", "NEED_SUPPORT"]);
    const imageUrl = optionalString(body, "imageUrl", { trim: true, max: 2000 }) ?? null;
    await createPost(req.userId, { content, recipeLink, type, imageUrl });
    return jsonOk(res, { success: true }, 201);
}
export async function postComment(req, res) {
    const body = requireObject(req.body);
    const postId = requireString(body, "postId", { trim: true, min: 8 });
    const content = requireString(body, "content", { trim: true, min: 1, max: 1000 });
    await addComment(req.userId, { postId, content });
    return jsonOk(res, { success: true }, 201);
}
export async function postLike(req, res) {
    const body = requireObject(req.body);
    const postId = requireString(body, "postId", { trim: true, min: 8 });
    const result = await toggleLike(req.userId, postId);
    return jsonOk(res, result);
}
export async function postAcceptAnswer(req, res) {
    const body = requireObject(req.body);
    const postId = requireString(body, "postId", { trim: true, min: 8 });
    const commentId = requireString(body, "commentId", { trim: true, min: 8 });
    const updated = await acceptAnswer(req.userId, { postId, commentId });
    return jsonOk(res, updated);
}
export async function postReport(req, res) {
    const postId = String(req.params.id ?? "").trim();
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason)
        throw new HttpError(400, "reason required");
    const data = await reportPost({ reporterId: req.userId, postId, reason });
    return jsonOk(res, data);
}
