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

  if (process.env.NODE_ENV === "development") {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
  // Log server-side so production 500s are diagnosable in the host's logs;
  // the client still only sees the generic message.
  console.error(err);
  return res.status(500).json({ error: "Unexpected error" });
}
