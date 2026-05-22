import type { Request, Response } from "express";
import { jsonOk } from "../../shared/http/json-response.js";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { optionalString, requireEnum, requireObject, requireString } from "../../shared/validation/validators.js";
import { addComment, createPost, getFeed, toggleLike, acceptAnswer } from "./posts.service.js";

export async function getPostsFeed(_req: Request, res: Response) {
  const posts = await getFeed();
  return jsonOk(res, posts);
}

export const requireUserMiddleware = requireUser;

export async function postCreate(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const content = requireString(body, "content", { trim: true, min: 1, max: 2200 });
  const recipeLink = optionalString(body, "recipeLink", { trim: true, max: 500 }) ?? null;
  const type = requireEnum(body, "type", ["QUESTION", "WIN", "MEAL_IDEA", "NEED_SUPPORT"] as const);
  const imageUrl = optionalString(body, "imageUrl", { trim: true, max: 2000 }) ?? null;
  await createPost(req.userId!, { content, recipeLink, type, imageUrl });
  return jsonOk(res, { success: true }, 201);
}

export async function postComment(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const postId = requireString(body, "postId", { trim: true, min: 8 });
  const content = requireString(body, "content", { trim: true, min: 1, max: 1000 });
  await addComment(req.userId!, { postId, content });
  return jsonOk(res, { success: true }, 201);
}

export async function postLike(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const postId = requireString(body, "postId", { trim: true, min: 8 });
  const result = await toggleLike(req.userId!, postId);
  return jsonOk(res, result);
}

export async function postAcceptAnswer(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const postId = requireString(body, "postId", { trim: true, min: 8 });
  const commentId = requireString(body, "commentId", { trim: true, min: 8 });
  const updated = await acceptAnswer(req.userId!, { postId, commentId });
  return jsonOk(res, updated);
}

