import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

// Prisma's `contains`/`startsWith`/`endsWith` compile to a raw SQL LIKE pattern
// without escaping the caller's input, so a literal "%" or "_" in a search term
// is interpreted as a SQL wildcard (e.g. "%" alone matches everything). Escape
// them — and the escape character itself — before they reach the LIKE pattern.
function escapeLikeSpecials(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// Optimal String Alignment distance (Levenshtein plus adjacent transpositions
// as a single edit) — small and dependency-free, enough to catch common typos
// like "protien" -> "protein" (a transposition) at catalog scale.
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

function typoTolerance(query: string): number {
  if (query.length <= 4) return 1;
  if (query.length <= 7) return 2;
  return 3;
}

// Only ever called after an exact search already came back empty — finds
// products whose name/tags contain a word within a small edit distance of
// the query, ordered by closeness. A capped in-memory scan is fine here
// since it's a fallback path, not the primary search, at this catalog scale.
async function fuzzyProductMatch(query: string, baseWhere: Record<string, unknown>): Promise<string[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const threshold = typoTolerance(q);
  const candidates = await prisma.product.findMany({
    where: baseWhere as any,
    select: { id: true, name: true, tags: true },
    take: 500,
  });
  return candidates
    .map((p) => {
      const words = [...p.name.toLowerCase().split(/\s+/), ...p.tags.map((t) => t.toLowerCase())];
      const best = Math.min(...words.map((w) => editDistance(q, w)));
      return { id: p.id, best };
    })
    .filter((p) => p.best <= threshold)
    .sort((a, b) => a.best - b.best)
    .map((p) => p.id);
}

const SORT_ORDER_BY: Record<string, Array<Record<string, "asc" | "desc">>> = {
  "price-low": [{ price: "asc" }],
  "price-high": [{ price: "desc" }],
  newest: [{ createdAt: "desc" }],
  // "popular" intentionally isn't mapped here — it falls through to the
  // isFeatured+createdAt default below, which is a real (if coarse)
  // popularity proxy. "rating" was removed from the UI's sort options
  // entirely (no review/rating aggregation exists to sort by), but an old
  // client or a direct API caller could still send sortBy=rating — falling
  // back to the default here rather than erroring keeps that harmless.
};

export async function listProducts(opts: {
  categorySlug?: string;
  status?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
  q?: string;
  sortBy?: string;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;

  const baseWhere: Record<string, unknown> = {};
  if (opts.status) baseWhere.status = opts.status;
  else baseWhere.status = "ACTIVE";
  if (opts.featured !== undefined) baseWhere.isFeatured = opts.featured;
  if (opts.categorySlug) {
    baseWhere.category = { slug: opts.categorySlug };
  }

  const where: Record<string, unknown> = { ...baseWhere };
  if (opts.q) {
    const likeQ = escapeLikeSpecials(opts.q);
    where.OR = [
      { name: { contains: likeQ, mode: "insensitive" } },
      { description: { contains: likeQ, mode: "insensitive" } },
      { tags: { has: opts.q } },
    ];
  }

  const orderBy = (opts.sortBy && SORT_ORDER_BY[opts.sortBy]) || [{ isFeatured: "desc" }, { createdAt: "desc" }];
  const categorySelect = { category: { select: { id: true, name: true, slug: true } } };

  let [total, products] = await Promise.all([
    prisma.product.count({ where: where as any }),
    prisma.product.findMany({ where: where as any, skip, take: limit, orderBy, include: categorySelect }),
  ]);

  // Typo-tolerant fallback: only kicks in when the exact search truly found
  // nothing — never touches a query that already has real matches, and never
  // touches the no-query (browse) path at all.
  if (opts.q && total === 0) {
    const matchIds = await fuzzyProductMatch(opts.q, baseWhere);
    if (matchIds.length > 0) {
      total = matchIds.length;
      const matched = await prisma.product.findMany({ where: { id: { in: matchIds } }, include: categorySelect });
      // Prisma can't ORDER BY a JS-computed rank, so re-sort by the fuzzy
      // match's closeness order (closest edit distance first) here.
      const rank = new Map(matchIds.map((id, i) => [id, i]));
      matched.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
      products = matched.slice(skip, skip + limit);
    }
  }

  return { products, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      reviews: {
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, image: true } } },
      },
    },
  });
  if (!product) throw new HttpError(404, "Product not found");
  return product;
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  if (!product) throw new HttpError(404, "Product not found");
  return product;
}

export async function createProduct(input: {
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice?: number | null;
  imageUrls?: string[];
  tags?: string[];
  status?: string;
  stock?: number;
  weight?: number | null;
  isVegan?: boolean;
  isFeatured?: boolean;
}) {
  const existing = await prisma.product.findUnique({ where: { slug: input.slug } });
  if (existing) throw new HttpError(400, "Slug already in use");

  const category = await prisma.productCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new HttpError(400, "Invalid category");

  return prisma.product.create({
    data: {
      categoryId: input.categoryId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      price: input.price,
      comparePrice: input.comparePrice ?? null,
      imageUrls: input.imageUrls ?? [],
      tags: input.tags ?? [],
      status: (input.status as any) ?? "DRAFT",
      stock: input.stock ?? 0,
      weight: input.weight ?? null,
      isVegan: input.isVegan ?? true,
      isFeatured: input.isFeatured ?? false,
    },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
}

export async function updateProduct(id: string, input: Partial<{
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice: number | null;
  imageUrls: string[];
  tags: string[];
  status: string;
  stock: number;
  weight: number | null;
  isVegan: boolean;
  isFeatured: boolean;
}>) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new HttpError(404, "Product not found");

  if (input.slug && input.slug !== product.slug) {
    const conflict = await prisma.product.findUnique({ where: { slug: input.slug } });
    if (conflict) throw new HttpError(400, "Slug already in use");
  }

  return prisma.product.update({
    where: { id },
    data: {
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.comparePrice !== undefined && { comparePrice: input.comparePrice }),
      ...(input.imageUrls !== undefined && { imageUrls: input.imageUrls }),
      ...(input.tags !== undefined && { tags: input.tags }),
      ...(input.status !== undefined && { status: input.status as any }),
      ...(input.stock !== undefined && { stock: input.stock }),
      ...(input.weight !== undefined && { weight: input.weight }),
      ...(input.isVegan !== undefined && { isVegan: input.isVegan }),
      ...(input.isFeatured !== undefined && { isFeatured: input.isFeatured }),
    },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
}

export async function deleteProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new HttpError(404, "Product not found");
  await prisma.product.delete({ where: { id } });
  return { success: true };
}

export async function listCategories() {
  return prisma.productCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

export async function createCategory(input: {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
}) {
  const existing = await prisma.productCategory.findUnique({ where: { slug: input.slug } });
  if (existing) throw new HttpError(400, "Category slug already in use");
  return prisma.productCategory.create({ data: input });
}

export async function updateCategory(id: string, input: Partial<{
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
}>) {
  const cat = await prisma.productCategory.findUnique({ where: { id } });
  if (!cat) throw new HttpError(404, "Category not found");
  return prisma.productCategory.update({ where: { id }, data: input });
}

export async function deleteCategory(id: string) {
  const cat = await prisma.productCategory.findUnique({ where: { id } });
  if (!cat) throw new HttpError(404, "Category not found");
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) throw new HttpError(400, "Cannot delete category with products");
  await prisma.productCategory.delete({ where: { id } });
  return { success: true };
}
