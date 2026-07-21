import { HttpError } from "../shared/errors/http-error.js";

function requireEnv(key: string) {
  const v = process.env[key];
  if (!v) throw new HttpError(500, `${key} not configured`);
  return v;
}

function optionalEnv(key: string) {
  const v = process.env[key];
  return v && v.trim() ? v : undefined;
}

export const env = {
  NODE_ENV: optionalEnv("NODE_ENV"),
  PORT: optionalEnv("PORT"),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  JWT_SECRET: (() => {
    const v = requireEnv("JWT_SECRET");
    if (v.length < 16) throw new HttpError(500, "JWT_SECRET too short");
    return v;
  })(),
  GOOGLE_CLIENT_ID: optionalEnv("GOOGLE_CLIENT_ID"),
  AUTH_FROM_EMAIL: optionalEnv("AUTH_FROM_EMAIL"),
  OPENAI_API_KEY: optionalEnv("OPENAI_API_KEY"),
  OPENAI_MODEL: optionalEnv("OPENAI_MODEL"),
  ANTHROPIC_API_KEY: optionalEnv("ANTHROPIC_API_KEY"),
  ANTHROPIC_MODEL: optionalEnv("ANTHROPIC_MODEL")
};

