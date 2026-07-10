import { Router } from "express";
import { jsonError } from "../../shared/http/json-response.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { draftDelete, getBookmarkedPosts, getDrafts, getMyStats, getPostsFeed, postDelete, postDraftCreate, postAcceptAnswer, postBookmark, postComment, postCommentLike, postCreate, postLike, postReport, requireUserMiddleware } from "./posts.controller.js";
export const postsRouter = Router();
// Public feed: no auth required
postsRouter.get("/posts/feed", async (req, res) => {
    try {
        await getPostsFeed(req, res);
    }
    catch (err) {
        return jsonError(res, err);
    }
});
postsRouter.post("/posts", requireUserMiddleware, asyncHandler(postCreate));
postsRouter.post("/posts/comment", requireUserMiddleware, asyncHandler(postComment));
postsRouter.post("/posts/like", requireUserMiddleware, asyncHandler(postLike));
postsRouter.post("/posts/comment/like", requireUserMiddleware, asyncHandler(postCommentLike));
postsRouter.post("/posts/bookmark", requireUserMiddleware, asyncHandler(postBookmark));
postsRouter.get("/posts/bookmarks", requireUserMiddleware, asyncHandler(getBookmarkedPosts));
postsRouter.get("/posts/stats/me", requireUserMiddleware, asyncHandler(getMyStats));
postsRouter.get("/posts/drafts", requireUserMiddleware, asyncHandler(getDrafts));
postsRouter.post("/posts/drafts", requireUserMiddleware, asyncHandler(postDraftCreate));
postsRouter.delete("/posts/drafts/:id", requireUserMiddleware, asyncHandler(draftDelete));
// Registered after /posts/drafts/:id so the drafts route wins for that path shape.
postsRouter.delete("/posts/:id", requireUserMiddleware, asyncHandler(postDelete));
postsRouter.post("/posts/accept-answer", requireUserMiddleware, asyncHandler(postAcceptAnswer));
postsRouter.post("/posts/:id/report", requireUserMiddleware, asyncHandler(postReport));
