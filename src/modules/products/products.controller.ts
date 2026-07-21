import type { Request, Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { requireObject, requireString } from "../../shared/validation/validators.js";
import { HttpError } from "../../shared/errors/http-error.js";

const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

function assertProductStatus(status: string): asserts status is (typeof PRODUCT_STATUSES)[number] {
  if (!(PRODUCT_STATUSES as readonly string[]).includes(status)) {
    throw new HttpError(400, `Invalid status: ${status}`);
  }
}
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  getProductById,
  getProductBySlug,
  listCategories,
  listProducts,
  updateCategory,
  updateProduct,
} from "./products.service.js";

export async function getProductByIdRoute(req: Request, res: Response) {
  const result = await getProductById(req.params.id);
  return jsonOk(res, result);
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const featured = req.query.featured === "true" ? true : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const sortBy = typeof req.query.sortBy === "string" ? req.query.sortBy : undefined;
  const result = await listProducts({ categorySlug: category, status, featured, page, limit, q, sortBy });
  return jsonOk(res, result);
}

export async function getProduct(req: Request, res: Response) {
  const slug = req.params.slug;
  const result = await getProductBySlug(slug);
  return jsonOk(res, result);
}

export async function postProduct(req: Request, res: Response) {
  const body = requireObject(req.body);
  const categoryId = requireString(body, "categoryId");
  const name = requireString(body, "name", { trim: true, min: 2, max: 200 });
  const slug = requireString(body, "slug", { trim: true, min: 2, max: 200 });
  const description = requireString(body, "description", { trim: true, min: 1 });
  const price = parseFloat(String(body.price ?? 0));
  const comparePrice = body.comparePrice != null ? parseFloat(String(body.comparePrice)) : null;
  const imageUrls: string[] = Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const tags: string[] = Array.isArray(body.tags) ? body.tags : [];
  const status = typeof body.status === "string" ? body.status : "DRAFT";
  assertProductStatus(status);
  const stock = parseInt(String(body.stock ?? 0));
  const weight = body.weight != null ? parseFloat(String(body.weight)) : null;
  const isVegan = body.isVegan !== false;
  const isFeatured = body.isFeatured === true;
  const result = await createProduct({ categoryId, name, slug, description, price, comparePrice, imageUrls, tags, status, stock, weight, isVegan, isFeatured });
  return res.status(201).json({ ok: true, data: result });
}

export async function patchProduct(req: Request, res: Response) {
  const { id } = req.params;
  const body = requireObject(req.body);
  const input: Record<string, unknown> = {};
  if (body.categoryId != null) input.categoryId = String(body.categoryId);
  if (body.name != null) input.name = String(body.name);
  if (body.slug != null) input.slug = String(body.slug);
  if (body.description != null) input.description = String(body.description);
  if (body.price != null) input.price = parseFloat(String(body.price));
  if (body.comparePrice !== undefined) input.comparePrice = body.comparePrice != null ? parseFloat(String(body.comparePrice)) : null;
  if (Array.isArray(body.imageUrls)) input.imageUrls = body.imageUrls;
  if (Array.isArray(body.tags)) input.tags = body.tags;
  if (body.status != null) {
    const status = String(body.status);
    assertProductStatus(status);
    input.status = status;
  }
  if (body.stock != null) input.stock = parseInt(String(body.stock));
  if (body.weight !== undefined) input.weight = body.weight != null ? parseFloat(String(body.weight)) : null;
  if (body.isVegan != null) input.isVegan = Boolean(body.isVegan);
  if (body.isFeatured != null) input.isFeatured = Boolean(body.isFeatured);
  const result = await updateProduct(id, input as any);
  return jsonOk(res, result);
}

export async function removeProduct(req: Request, res: Response) {
  const result = await deleteProduct(req.params.id);
  return jsonOk(res, result);
}

// ─── Categories ───────────────────────────────────────────────────────────────

export async function getCategories(_req: Request, res: Response) {
  const result = await listCategories();
  return jsonOk(res, result);
}

export async function postCategory(req: Request, res: Response) {
  const body = requireObject(req.body);
  const name = requireString(body, "name", { trim: true, min: 2, max: 100 });
  const slug = requireString(body, "slug", { trim: true, min: 2, max: 100 });
  const description = typeof body.description === "string" ? body.description : undefined;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0;
  const result = await createCategory({ name, slug, description, imageUrl, sortOrder });
  return res.status(201).json({ ok: true, data: result });
}

export async function patchCategory(req: Request, res: Response) {
  const body = requireObject(req.body);
  const input: Record<string, unknown> = {};
  if (body.name != null) input.name = String(body.name);
  if (body.slug != null) input.slug = String(body.slug);
  if (body.description != null) input.description = String(body.description);
  if (body.imageUrl != null) input.imageUrl = String(body.imageUrl);
  if (body.sortOrder != null) input.sortOrder = parseInt(String(body.sortOrder));
  const result = await updateCategory(req.params.id, input as any);
  return jsonOk(res, result);
}

export async function removeCategory(req: Request, res: Response) {
  const result = await deleteCategory(req.params.id);
  return jsonOk(res, result);
}
