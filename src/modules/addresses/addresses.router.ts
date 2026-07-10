import { Router } from "express";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { requireUser } from "../../shared/middleware/auth.middleware.js";
import { getAddresses, patchAddress, postAddress, postSetDefaultAddress, removeAddress } from "./addresses.controller.js";

export const addressesRouter = Router();

addressesRouter.get("/addresses", requireUser, asyncHandler(getAddresses));
addressesRouter.post("/addresses", requireUser, asyncHandler(postAddress));
addressesRouter.patch("/addresses/:id", requireUser, asyncHandler(patchAddress));
addressesRouter.post("/addresses/:id/default", requireUser, asyncHandler(postSetDefaultAddress));
addressesRouter.delete("/addresses/:id", requireUser, asyncHandler(removeAddress));
