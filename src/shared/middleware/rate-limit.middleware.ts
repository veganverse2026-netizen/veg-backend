import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { AuthedRequest } from "./auth.middleware.js";

// OTP request endpoints trigger a real email send — throttle per-IP to blunt
// email-bombing and account-enumeration probing.
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" }
});

// Password/OTP-verify login endpoints — throttle brute-force attempts.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" }
});

// AI assistant chat calls the paid Anthropic API per request — throttle per-user
// (falling back to per-IP) to cap abuse cost.
export const aiChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const userId = (req as AuthedRequest).userId;
    return userId ?? ipKeyGenerator(req.ip ?? "");
  },
  message: { error: "Too many AI assistant requests, please try again later" }
});
