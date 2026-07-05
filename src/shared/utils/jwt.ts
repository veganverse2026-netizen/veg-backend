import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../errors/http-error.js";

export type JwtPayload = {
  sub: string;
  role?: string;
};

export function signAccessToken(userId: string, role?: string) {
  const payload: JwtPayload = { sub: userId };
  if (role) payload.role = role;
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as any;
  if (!decoded?.sub) throw new HttpError(401, "Invalid token");
  return { sub: String(decoded.sub), role: decoded.role ?? undefined };
}
