import { Router } from "express";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireUser } from "../../shared/middleware/auth.middleware.js";
import { deleteWishlistItem, getWishlist, postWishlist } from "./wishlist.controller.js";

export const wishlistRouter = Router();

wishlistRouter.get("/wishlist", requireUser, asyncHandler(getWishlist));
wishlistRouter.post("/wishlist", requireUser, asyncHandler(postWishlist));
wishlistRouter.delete("/wishlist/:productId", requireUser, asyncHandler(deleteWishlistItem));
