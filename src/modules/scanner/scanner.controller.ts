import type { Response } from "express";
import type { AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonOk } from "../../shared/http/json-response.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { listScanHistory, scanBarcode } from "./scanner.service.js";

export async function getScanBarcode(req: AuthedRequest, res: Response) {
  const barcode = String(req.params.barcode ?? "").trim();
  if (!barcode) throw new HttpError(400, "Barcode is required");
  const result = await scanBarcode(req.userId!, barcode);
  return jsonOk(res, result);
}

export async function getScanHistory(req: AuthedRequest, res: Response) {
  const result = await listScanHistory(req.userId!);
  return jsonOk(res, result);
}
