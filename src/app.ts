import express from "express";
import cors from "cors";
import helmet from "helmet";
import { apiRouter } from "./routes/index.js";
import { jsonError } from "./shared/http/json-response.js";
import { HttpError } from "./shared/errors/http-error.js";
import { generalApiLimiter } from "./shared/middleware/rate-limit.middleware.js";

const DEV_ORIGINS = process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://localhost:3001"] : [];

const ALLOWED_ORIGINS = [
  ...DEV_ORIGINS,
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean) as string[];

export function createApp() {
  const app = express();

  // Behind Render's (and any single) reverse proxy: trust the first hop so
  // req.ip is the real client IP. Without this, every request appears to come
  // from the proxy and per-IP rate limits (e.g. 5 OTP requests / 15 min) are
  // shared by ALL users.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", generalApiLimiter, apiRouter);

  app.use((_req, _res, next) => next(new HttpError(404, "Not found")));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    return jsonError(res, err);
  });

  return app;
}
