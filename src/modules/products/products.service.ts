import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

export async function listProducts(opts: {
  categorySlug?: string;
  status?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
  q?: string;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (opts.status) where.status = opts.status;
  else where.status = "ACTIVE";
  if (opts.featured !== undefined) where.isFeatured = opts.featured;
  if (opts.categorySlug) {
    where.category = { slug: opts.categorySlug };
  }
  if (opts.q) {
    where.OR = [
      { name: { contains: opts.q, mode: "insensitive" } },
      { description: { contains: opts.q, mode: "insensitive" } },
      { tags: { has: opts.q } },
    ];
  }

  const [total, products] = await Promise.all([
    prisma.product.count({ where: where as any }),
    prisma.product.findMany({
      where: where as any,
      skip,
      take: limit,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
  ]);

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
