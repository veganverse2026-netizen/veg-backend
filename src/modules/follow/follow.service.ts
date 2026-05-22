import { prisma } from "../../infrastructure/db/prisma.js";

export async function toggleFollow(followerId: string, followingId: string) {
  const userExists = await prisma.user.findUnique({ where: { id: followingId }, select: { id: true } });
  if (!userExists) return { status: 404 as const, body: { error: "User not found" } };

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } }
  });
  if (existing) {
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId } }
    });
    return { status: 200 as const, body: { following: false } };
  }

  await prisma.follow.create({ data: { followerId, followingId } });
  return { status: 200 as const, body: { following: true } };
}

