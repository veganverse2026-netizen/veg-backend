import { Router } from "express";
import crypto from "crypto";
import { requireUser, type AuthedRequest } from "../../shared/middleware/auth.middleware.js";
import { jsonError, jsonOk } from "../../shared/http/json-response.js";
import { requireObject, optionalString } from "../../shared/validation/validators.js";

export const uploadsRouter = Router();

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured. Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
  }
  return { cloudName, apiKey, apiSecret };
}

function signCloudinary(params: Record<string, string>, apiSecret: string) {
  const toSign = Object.entries(params)
    .filter(([, v]) => v != null && String(v).length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return crypto.createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");
}

uploadsRouter.post("/uploads/sign", requireUser, async (req: AuthedRequest, res) => {
  try {
    const body = requireObject(req.body);
    const purpose = (optionalString(body, "purpose", { trim: true, max: 40 }) ?? "post").toLowerCase();

    const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder =
      purpose === "profile"
        ? process.env.CLOUDINARY_FOLDER_PROFILES || "veganfit/profiles"
        : purpose === "challenge"
        ? process.env.CLOUDINARY_FOLDER_CHALLENGES || "veganfit/challenges"
        : purpose === "voice"
        ? process.env.CLOUDINARY_FOLDER_VOICE || "veganfit/voice"
        : process.env.CLOUDINARY_FOLDER_POSTS || "veganfit/posts";

    const signature = signCloudinary({ folder, timestamp }, apiSecret);

    return jsonOk(res, {
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder
    });
  } catch (err) {
    return jsonError(res, err);
  }
});
