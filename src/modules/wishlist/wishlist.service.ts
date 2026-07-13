import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";

export async function listMyWishlist(userId: string) {
  return prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: { id: true, name: true, slug: true, price: true, comparePrice: true, imageUrls: true, stock: true, status: true }
      }
    }
  });
}

export async function addToWishlist(userId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new HttpError(404, "Product not found");

  return prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
    include: {
      product: {
        select: { id: true, name: true, slug: true, price: true, comparePrice: true, imageUrls: true, stock: true, status: true }
      }
    }
  });
}

export async function removeFromWishlist(userId: string, productId: string) {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  return { ok: true };
}
