import { Router } from "express";
import { jsonError } from "../../shared/http/json-response.js";
import { requireUser } from "../../shared/middleware/auth.middleware.js";
import { requireAdmin } from "../../shared/middleware/admin.middleware.js";
import {
  getCategories,
  getProduct,
  getProductByIdRoute,
  getProducts,
  patchCategory,
  patchProduct,
  postCategory,
  postProduct,
  removeCategory,
  removeProduct,
} from "./products.controller.js";

export const productsRouter = Router();

// ─── Public product routes ──────────────────────────────────────────────────
productsRouter.get("/products", async (req, res) => {
  try { await getProducts(req, res); } catch (err) { return jsonError(res, err); }
});

productsRouter.get("/products/categories", async (req, res) => {
  try { await getCategories(req, res); } catch (err) { return jsonError(res, err); }
});

productsRouter.get("/products/by-id/:id", async (req, res) => {
  try { await getProductByIdRoute(req, res); } catch (err) { return jsonError(res, err); }
});

productsRouter.get("/products/:slug", async (req, res) => {
  try { await getProduct(req, res); } catch (err) { return jsonError(res, err); }
});

// ─── Admin-only product management ─────────────────────────────────────────
productsRouter.post("/products", requireUser, requireAdmin, async (req, res) => {
  try { await postProduct(req, res); } catch (err) { return jsonError(res, err); }
});

productsRouter.patch("/products/:id", requireUser, requireAdmin, async (req, res) => {
  try { await patchProduct(req, res); } catch (err) { return jsonError(res, err); }
});

productsRouter.delete("/products/:id", requireUser, requireAdmin, async (req, res) => {
  try { await removeProduct(req, res); } catch (err) { return jsonError(res, err); }
});

// ─── Admin-only category management ────────────────────────────────────────
productsRouter.post("/products/categories", requireUser, requireAdmin, async (req, res) => {
  try { await postCategory(req, res); } catch (err) { return jsonError(res, err); }
});

productsRouter.patch("/products/categories/:id", requireUser, requireAdmin, async (req, res) => {
  try { await patchCategory(req, res); } catch (err) { return jsonError(res, err); }
});

productsRouter.delete("/products/categories/:id", requireUser, requireAdmin, async (req, res) => {
  try { await removeCategory(req, res); } catch (err) { return jsonError(res, err); }
});
