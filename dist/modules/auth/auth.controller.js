import { jsonOk } from "../../shared/http/json-response.js";
import { requireObject, requireString } from "../../shared/validation/validators.js";
import { credentialsAuthorize, forgotRequestOtp, forgotReset, healthCheck, loginGoogle, loginPassword, loginRequestOtp, loginVerifyOtp, refreshToken, signupRequestOtp, signupVerifyOtp } from "./auth.service.js";
export async function getAuthHealth(_req, res) {
    await healthCheck();
    return jsonOk(res, { ok: true });
}
export async function postSignupRequestOtp(req, res) {
    const body = requireObject(req.body);
    const name = requireString(body, "name", { trim: true, min: 2, max: 120 });
    const email = requireString(body, "email", { trim: true, min: 3 });
    const password = requireString(body, "password", { min: 8 });
    const result = await signupRequestOtp({ name, email, password });
    return jsonOk(res, result);
}
export async function postSignupVerifyOtp(req, res) {
    const body = requireObject(req.body);
    const email = requireString(body, "email", { trim: true, min: 3 });
    const otp = requireString(body, "otp", { trim: true, min: 6, max: 6 });
    const result = await signupVerifyOtp({ email, otp });
    return jsonOk(res, result);
}
export async function postLoginRequestOtp(req, res) {
    const body = requireObject(req.body);
    const email = requireString(body, "email", { trim: true, min: 3 });
    const password = requireString(body, "password", { min: 8 });
    const result = await loginRequestOtp({ email, password });
    return jsonOk(res, result);
}
export async function postLoginVerifyOtp(req, res) {
    const body = requireObject(req.body);
    const email = requireString(body, "email", { trim: true, min: 3 });
    const otp = requireString(body, "otp", { trim: true, min: 6, max: 6 });
    const result = await loginVerifyOtp({ email, otp });
    return jsonOk(res, result);
}
export async function postForgotRequestOtp(req, res) {
    const body = requireObject(req.body);
    const email = requireString(body, "email", { trim: true, min: 3 });
    const result = await forgotRequestOtp({ email });
    return jsonOk(res, result);
}
export async function postForgotReset(req, res) {
    const body = requireObject(req.body);
    const email = requireString(body, "email", { trim: true, min: 3 });
    const otp = requireString(body, "otp", { trim: true, min: 6, max: 6 });
    const password = requireString(body, "password", { min: 8 });
    const result = await forgotReset({ email, otp, password });
    return jsonOk(res, result);
}
export async function postCredentialsAuthorize(req, res) {
    const body = requireObject(req.body);
    const email = requireString(body, "email", { trim: true, min: 3 });
    const password = requireString(body, "password", { min: 8 });
    const result = await credentialsAuthorize({ email, password });
    return jsonOk(res, result);
}
export async function postLoginPassword(req, res) {
    const body = requireObject(req.body);
    const email = requireString(body, "email", { trim: true, min: 3 });
    const password = requireString(body, "password", { min: 8 });
    const result = await loginPassword({ email, password });
    return jsonOk(res, result);
}
export async function postLoginGoogle(req, res) {
    const body = requireObject(req.body);
    const idToken = requireString(body, "idToken", { trim: true, min: 20 });
    const result = await loginGoogle({ idToken });
    return jsonOk(res, result);
}
export async function postRefreshToken(req, res) {
    const body = requireObject(req.body);
    const token = requireString(body, "token", { trim: true, min: 10 });
    const result = await refreshToken({ token });
    return jsonOk(res, result);
}
export async function postLogout(_req, res) {
    return jsonOk(res, { success: true, message: "Logged out" });
}
