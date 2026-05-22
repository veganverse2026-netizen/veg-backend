import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../errors/http-error.js";

type JwtPayload = {
  sub: string;
};

export function signAccessToken(userId: string) {
  return jwt.sign({ sub: userId } satisfies JwtPayload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as any;
  if (!decoded?.sub) throw new HttpError(401, "Invalid token");
  return { sub: String(decoded.sub) };
}
