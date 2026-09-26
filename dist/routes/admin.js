import { Router } from "express";
import { jsonError } from "../http/http-response.js";
import { requireAdmin } from "../middleware/admin.js";
import { getOverview, getUsers, patchUserRole } from "../modules/admin/admin.controller.js";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export const adminRouter = Router();
adminRouter.get("/admin/overview", requireAdmin, async (req, res) => {
    try {
        await getOverview(req, res);
    }
    catch (err) {
        return jsonError(res, err);
    }
});
adminRouter.get("/admin/users", requireAdmin, async (req, res) => {
    try {
        await getUsers(req, res);
    }
    catch (err) {
        return jsonError(res, err);
    }
});
adminRouter.patch("/admin/users/:id/role", requireAdmin, async (req, res) => {
    try {
        await patchUserRole(req, res);
    }
    catch (err) {
        return jsonError(res, err);
    }
});
