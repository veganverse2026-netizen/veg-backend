import type { Response } from "express";
import { HttpError } from "../errors/http-error.js";
import { mapInfrastructureError } from "../errors/infra-error-map.js";

export function jsonOk<T>(res: Response, data: T, status = 200) {
  return res.status(status).json(data);
}

export function jsonError(res: Response, err: unknown) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  const infra = mapInfrastructureError(err);
  if (infra) {
    console.error(err);
    return res.status(infra.status).json({ error: infra.message });
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
  return res.status(500).json({ error: "Unexpected error" });
}
