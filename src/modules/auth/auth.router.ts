import { Router } from "express";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { loginLimiter, otpRequestLimiter } from "../../shared/middleware/rate-limit.middleware.js";
import {
  getAuthHealth,
  postCredentialsAuthorize,
  postForgotRequestOtp,
  postForgotReset,
  postLoginGoogle,
  postLoginPassword,
  postLoginRequestOtp,
  postLoginVerifyOtp,
  postLogout,
  postRefreshToken,
  postSignupRequestOtp,
  postSignupVerifyOtp
} from "./auth.controller.js";

export const authRouter = Router();

authRouter.get("/auth/health", async (_req, res) => {
  try {
    await getAuthHealth(_req, res);
    return;
  } catch (err) {
    return jsonError(res, err);
  }
});

authRouter.post("/auth/signup/request-otp", otpRequestLimiter, asyncHandler(postSignupRequestOtp));

authRouter.post("/auth/signup/verify-otp", loginLimiter, asyncHandler(postSignupVerifyOtp));

authRouter.post("/auth/login/request-otp", otpRequestLimiter, asyncHandler(postLoginRequestOtp));

authRouter.post("/auth/login/verify-otp", loginLimiter, asyncHandler(postLoginVerifyOtp));

authRouter.post("/auth/forgot/request-otp", otpRequestLimiter, asyncHandler(postForgotRequestOtp));

authRouter.post("/auth/forgot/reset", loginLimiter, asyncHandler(postForgotReset));

// Used by NextAuth CredentialsProvider:
authRouter.post("/auth/credentials/authorize", loginLimiter, asyncHandler(postCredentialsAuthorize));

// Email + password login (no OTP), returns JWT for REST API usage
authRouter.post("/auth/login/password", loginLimiter, asyncHandler(postLoginPassword));

// Google login: client sends ID token, backend verifies, returns JWT
authRouter.post("/auth/login/google", asyncHandler(postLoginGoogle));

// Token refresh: client sends current valid token, gets a fresh one back
authRouter.post("/auth/refresh", asyncHandler(postRefreshToken));

// Logout: client clears its own token; server just acknowledges
authRouter.post("/auth/logout", asyncHandler(postLogout));
