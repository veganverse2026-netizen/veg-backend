import type { Request, Response } from "express";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { optionalString, requireEnum, requireObject, requireString } from "../../shared/validation/validators.js";
import {
  addComment,
  createPost,
  getFeed,
  toggleLike,
  toggleCommentLike,
  toggleBookmark,
  listBookmarkedPosts,
  acceptAnswer,
  reportPost
} from "./posts.service.js";

export async function getPostsFeed(_req: Request, res: Response) {
  const posts = await getFeed();
  return jsonOk(res, posts);
}

export const requireUserMiddleware = requireUser;

export async function postCreate(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const imageUrl = optionalString(body, "imageUrl", { trim: true, max: 2000 }) ?? null;
  // A caption is required unless the post has a photo — matches typical
  // photo-sharing behavior (Instagram-style posts can be image-only).
  const content = imageUrl
    ? optionalString(body, "content", { trim: true, max: 2200 }) ?? ""
    : requireString(body, "content", { trim: true, min: 1, max: 2200 });
  const recipeLink = optionalString(body, "recipeLink", { trim: true, max: 500 }) ?? null;
  const type = requireEnum(body, "type", ["QUESTION", "WIN", "MEAL_IDEA", "NEED_SUPPORT"] as const);
  const post = await createPost(req.userId!, { content, recipeLink, type, imageUrl });
  return jsonOk(res, post, 201);
}

export async function postComment(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const postId = requireString(body, "postId", { trim: true, min: 8 });
  const content = requireString(body, "content", { trim: true, min: 1, max: 1000 });
  const parentId = optionalString(body, "parentId", { trim: true, max: 40 }) ?? null;
  const comment = await addComment(req.userId!, { postId, content, parentId });
  return jsonOk(res, comment, 201);
}

export async function postLike(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const postId = requireString(body, "postId", { trim: true, min: 8 });
  const result = await toggleLike(req.userId!, postId);
  return jsonOk(res, result);
}

export async function postCommentLike(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const commentId = requireString(body, "commentId", { trim: true, min: 8 });
  const result = await toggleCommentLike(req.userId!, commentId);
  return jsonOk(res, result);
}

export async function postBookmark(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const postId = requireString(body, "postId", { trim: true, min: 8 });
  const result = await toggleBookmark(req.userId!, postId);
  return jsonOk(res, result);
}

export async function getBookmarkedPosts(req: AuthedRequest, res: Response) {
  const posts = await listBookmarkedPosts(req.userId!);
  return jsonOk(res, posts);
}

export async function postAcceptAnswer(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const postId = requireString(body, "postId", { trim: true, min: 8 });
  const commentId = requireString(body, "commentId", { trim: true, min: 8 });
  const updated = await acceptAnswer(req.userId!, { postId, commentId });
  return jsonOk(res, updated);
}

export async function postReport(req: AuthedRequest, res: Response) {
  const postId = String(req.params.id ?? "").trim();
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) throw new HttpError(400, "reason required");
  const data = await reportPost({ reporterId: req.userId!, postId, reason });
  return jsonOk(res, data);
}

