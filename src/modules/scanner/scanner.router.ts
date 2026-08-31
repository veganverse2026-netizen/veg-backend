import { Router } from "express";
import { requireUser } from "../../shared/middleware/auth.middleware.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { getScanBarcode, getScanHistory } from "./scanner.controller.js";

export const scannerRouter = Router();

scannerRouter.get("/scanner/history", requireUser, asyncHandler(getScanHistory));

scannerRouter.get("/scanner/:barcode", requireUser, asyncHandler(getScanBarcode));
