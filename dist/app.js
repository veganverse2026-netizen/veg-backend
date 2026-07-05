import express from "express";
import cors from "cors";
import helmet from "helmet";
import { apiRouter } from "./routes/index.js";
import { jsonError } from "./shared/http/json-response.js";
import { HttpError } from "./shared/errors/http-error.js";
const ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.FRONTEND_URL,
    process.env.ADMIN_URL,
].filter(Boolean);
export function createApp() {
    const app = express();
    app.use(helmet());
    app.use(cors({
        origin: (origin, cb) => {
            if (!origin || ALLOWED_ORIGINS.includes(origin))
                return cb(null, true);
            return cb(new Error("Not allowed by CORS"));
        },
        credentials: true,
    }));
    app.use(express.json({ limit: "1mb" }));
    app.get("/health", (_req, res) => res.json({ ok: true }));
    app.use("/api", apiRouter);
    app.use((_req, _res, next) => next(new HttpError(404, "Not found")));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((err, _req, res, _next) => {
        return jsonError(res, err);
    });
    return app;
}
