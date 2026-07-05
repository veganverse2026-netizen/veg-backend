import { prisma } from "../../infrastructure/db/prisma.js";
import { HttpError } from "../../shared/errors/http-error.js";
import type { ReportStatus } from "@prisma/client";

export async function adminListPosts(opts: { page?: number; limit?: number; q?: string }) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, opts.limit ?? 20);
  const skip = (page - 1) * limit;
  const q = opts.q?.trim();
  const where = q ? { content: { contains: q, mode: "insensitive" as const } } : undefined;
  const [total, items] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true, likes: true, reports: true } },
      },
    }),
  ]);
  return { total, page, limit, pages: Math.ceil(total / limit) || 1, items };
}

export async function adminDeletePost(postId: string) {
  const p = await prisma.post.findUnique({ where: { id: postId } });
  if (!p) throw new HttpError(404, "Post not found");
  await prisma.post.delete({ where: { id: postId } });
  return { ok: true };
}

export async function adminListReports(opts: { page?: number; limit?: number; status?: ReportStatus }) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, opts.limit ?? 20);
  const skip = (page - 1) * limit;
  const where = opts.status ? { status: opts.status } : undefined;
  const [total, items] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        post: { select: { id: true, content: true, userId: true } },
      },
    }),
  ]);
  return { total, page, limit, pages: Math.ceil(total / limit) || 1, items };
}

export async function adminResolveReport(reportId: string, opts: { status: ReportStatus; resolvedBy: string }) {
  const r = await prisma.report.findUnique({ where: { id: reportId } });
  if (!r) throw new HttpError(404, "Report not found");
  return prisma.report.update({
    where: { id: reportId },
    data: { status: opts.status, resolvedAt: new Date(), resolvedBy: opts.resolvedBy },
  });
}
