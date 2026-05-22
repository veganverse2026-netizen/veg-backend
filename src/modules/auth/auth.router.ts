import { Router } from "express";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import {
  getAuthHealth,
  postCredentialsAuthorize,
  postForgotRequestOtp,
  postForgotReset,
  postLoginGoogle,
  postLoginPassword,
  postLoginRequestOtp,
  postLoginVerifyOtp,
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

authRouter.post("/auth/signup/request-otp", asyncHandler(postSignupRequestOtp));

authRouter.post("/auth/signup/verify-otp", asyncHandler(postSignupVerifyOtp));

authRouter.post("/auth/login/request-otp", asyncHandler(postLoginRequestOtp));

authRouter.post("/auth/login/verify-otp", asyncHandler(postLoginVerifyOtp));

authRouter.post("/auth/forgot/request-otp", asyncHandler(postForgotRequestOtp));

authRouter.post("/auth/forgot/reset", asyncHandler(postForgotReset));

// Used by NextAuth CredentialsProvider:
authRouter.post("/auth/credentials/authorize", asyncHandler(postCredentialsAuthorize));

// Email + password login (no OTP), returns JWT for REST API usage
authRouter.post("/auth/login/password", asyncHandler(postLoginPassword));

// Google login: client sends ID token, backend verifies, returns JWT
authRouter.post("/auth/login/google", asyncHandler(postLoginGoogle));
