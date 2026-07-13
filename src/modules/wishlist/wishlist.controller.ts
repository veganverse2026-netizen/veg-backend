import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { requireObject, requireString } from "../../shared/validation/validators.js";
import { addToWishlist, listMyWishlist, removeFromWishlist } from "./wishlist.service.js";

export async function getWishlist(req: AuthedRequest, res: Response) {
  return jsonOk(res, await listMyWishlist(req.userId!));
}

export async function postWishlist(req: AuthedRequest, res: Response) {
  const body = requireObject(req.body);
  const productId = requireString(body, "productId", { trim: true, min: 1, max: 60 });
  return jsonOk(res, await addToWishlist(req.userId!, productId), 201);
}

export async function deleteWishlistItem(req: AuthedRequest, res: Response) {
  return jsonOk(res, await removeFromWishlist(req.userId!, req.params.productId));
}
