import { Router } from "express";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import {
  getBookmarkedPosts,
  getPostsFeed,
  postAcceptAnswer,
  postBookmark,
  postComment,
  postCommentLike,
  postCreate,
  postLike,
  postReport,
  requireUserMiddleware
} from "./posts.controller.js";

export const postsRouter = Router();

// Public feed: no auth required
postsRouter.get("/posts/feed", async (req, res) => {
  try {
    await getPostsFeed(req, res);
  } catch (err) {
    return jsonError(res, err);
  }
});

postsRouter.post("/posts", requireUserMiddleware, asyncHandler(postCreate));

postsRouter.post("/posts/comment", requireUserMiddleware, asyncHandler(postComment));

postsRouter.post("/posts/like", requireUserMiddleware, asyncHandler(postLike));

postsRouter.post("/posts/comment/like", requireUserMiddleware, asyncHandler(postCommentLike));

postsRouter.post("/posts/bookmark", requireUserMiddleware, asyncHandler(postBookmark));

postsRouter.get("/posts/bookmarks", requireUserMiddleware, asyncHandler(getBookmarkedPosts));

postsRouter.post("/posts/accept-answer", requireUserMiddleware, asyncHandler(postAcceptAnswer));

postsRouter.post("/posts/:id/report", requireUserMiddleware, asyncHandler(postReport));

