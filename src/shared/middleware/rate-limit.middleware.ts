import rateLimit from "express-rate-limit";

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
