import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { adminListPosts, adminDeletePost as svcDeletePost, adminListReports, adminResolveReport as svcResolveReport } from "./admin-community.service.js";
import type { ReportStatus } from "@prisma/client";

const VALID_STATUSES: ReportStatus[] = ["PENDING", "RESOLVED", "DISMISSED"];

export async function adminGetPosts(req: AuthedRequest, res: Response) {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;
  return jsonOk(res, await adminListPosts({ page, limit, q }));
}

export async function adminDeletePost(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!id) throw new HttpError(400, "id required");
  return jsonOk(res, await svcDeletePost(id));
}

export async function adminGetReports(req: AuthedRequest, res: Response) {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  const statusRaw = typeof req.query.status === "string" ? req.query.status.toUpperCase() as ReportStatus : undefined;
  const status = statusRaw && VALID_STATUSES.includes(statusRaw) ? statusRaw : undefined;
  return jsonOk(res, await adminListReports({ page, limit, status }));
}

export async function adminResolveReport(req: AuthedRequest, res: Response) {
  const id = String(req.params.id ?? "").trim();
  if (!id) throw new HttpError(400, "id required");
  const statusRaw = String(req.body?.status ?? "").toUpperCase() as ReportStatus;
  if (!VALID_STATUSES.includes(statusRaw)) throw new HttpError(400, "Invalid status");
  return jsonOk(res, await svcResolveReport(id, { status: statusRaw, resolvedBy: req.userId! }));
}
