import crypto from "crypto";
import { compare, hash } from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../infrastructure/db/prisma.js";
import { signAccessToken, verifyAccessToken } from "../../shared/utils/jwt.js";
import { HttpError } from "../../shared/errors/http-error.js";
import { generateOtpCode, hashOtpCode, otpExpiry, safeEqualHash } from "../../shared/utils/otp.js";
import { sendOtpEmail } from "../../infrastructure/mailer/mailer.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function hashProofToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function healthCheck() {
  await prisma.$queryRaw`SELECT 1`;
}

export async function signupRequestOtp(input: { name: string; email: string; password: string }) {
  const email = input.email.toLowerCase().trim();
  const code = generateOtpCode();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new HttpError(400, "Email already in use");

  await prisma.otpChallenge.updateMany({ where: { email, purpose: "SIGNUP", consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.otpChallenge.create({
    data: {
      email,
      purpose: "SIGNUP",
      codeHash: hashOtpCode(code),
      expiresAt: otpExpiry(10),
      name: input.name,
      passwordHash: await hash(input.password, 10)
    }
  });

  const emailResult = await sendOtpEmail({ to: email, code, purpose: "SIGNUP" });
  const response: Record<string, unknown> = { success: true, emailSent: emailResult.sent, message: emailResult.reason ?? null };
  if (!emailResult.sent && process.env.NODE_ENV !== "production") response.devOtp = code;
  return response;
}

export async function signupVerifyOtp(input: { email: string; otp: string }) {
  const email = input.email.toLowerCase().trim();

  const challenge = await prisma.otpChallenge.findFirst({
    where: { email, purpose: "SIGNUP", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });

  if (!challenge) throw new HttpError(400, "OTP expired or invalid");
  if (challenge.attempts >= 5) throw new HttpError(429, "Too many attempts. Request new OTP.");

  const valid = safeEqualHash(challenge.codeHash, hashOtpCode(input.otp));
  if (!valid) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "Incorrect OTP");
  }

  if (!challenge.passwordHash) throw new HttpError(400, "Signup challenge incomplete");

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new HttpError(400, "Email already in use");

  const user =
    (await prisma.user.create({
      data: {
        name: challenge.name ?? null,
        email,
        passwordHash: challenge.passwordHash
      }
    })) ?? null;

  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });

  const otpProof = crypto.randomBytes(24).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: `otp-login:${email}`,
      token: hashProofToken(otpProof),
      expires: new Date(Date.now() + 5 * 60 * 1000)
    }
  });

  return { success: true, otpProof, userId: user?.id };
}

export async function loginRequestOtp(input: { email: string; password: string }) {
  const email = input.email.toLowerCase().trim();
  const code = generateOtpCode();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) throw new HttpError(401, "Invalid credentials");

  const validPassword = await compare(input.password, user.passwordHash);
  if (!validPassword) throw new HttpError(401, "Invalid credentials");

  await prisma.otpChallenge.updateMany({ where: { email, purpose: "LOGIN", consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.otpChallenge.create({ data: { email, purpose: "LOGIN", codeHash: hashOtpCode(code), expiresAt: otpExpiry(10) } });

  const emailResult = await sendOtpEmail({ to: email, code, purpose: "LOGIN" });
  const response: Record<string, unknown> = { success: true, emailSent: emailResult.sent, message: emailResult.reason ?? null };
  if (!emailResult.sent && process.env.NODE_ENV !== "production") response.devOtp = code;
  return response;
}

export async function loginVerifyOtp(input: { email: string; otp: string }) {
  const email = input.email.toLowerCase().trim();

  const challenge = await prisma.otpChallenge.findFirst({
    where: { email, purpose: "LOGIN", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });

  if (!challenge) throw new HttpError(400, "OTP expired or invalid");
  if (challenge.attempts >= 5) throw new HttpError(429, "Too many attempts. Request new OTP.");

  const valid = safeEqualHash(challenge.codeHash, hashOtpCode(input.otp));
  if (!valid) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "Incorrect OTP");
  }

  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });

  const otpProof = crypto.randomBytes(24).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: `otp-login:${email}`,
      token: hashProofToken(otpProof),
      expires: new Date(Date.now() + 5 * 60 * 1000)
    }
  });

  return { success: true, otpProof };
}

export async function forgotRequestOtp(input: { email: string }) {
  const email = input.email.toLowerCase().trim();
  const code = generateOtpCode();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(400, "No account found for this email");

  await prisma.otpChallenge.updateMany({ where: { email, purpose: "RESET", consumedAt: null }, data: { consumedAt: new Date() } });
  await prisma.otpChallenge.create({ data: { email, purpose: "RESET", codeHash: hashOtpCode(code), expiresAt: otpExpiry(10) } });

  const emailResult = await sendOtpEmail({ to: email, code, purpose: "RESET" });
  const response: Record<string, unknown> = { success: true, emailSent: emailResult.sent, message: emailResult.reason ?? null };
  if (!emailResult.sent && process.env.NODE_ENV !== "production") response.devOtp = code;
  return response;
}

export async function forgotReset(input: { email: string; otp: string; password: string }) {
  const email = input.email.toLowerCase().trim();

  const challenge = await prisma.otpChallenge.findFirst({
    where: { email, purpose: "RESET", consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });

  if (!challenge) throw new HttpError(400, "OTP expired or invalid");
  if (challenge.attempts >= 5) throw new HttpError(429, "Too many attempts. Request new OTP.");

  const valid = safeEqualHash(challenge.codeHash, hashOtpCode(input.otp));
  if (!valid) {
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    throw new HttpError(400, "Incorrect OTP");
  }

  const passwordHash = await hash(input.password, 10);
  await prisma.user.update({ where: { email }, data: { passwordHash } });
  await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });

  return { success: true };
}

export async function credentialsAuthorize(input: { email: string; password: string }) {
  const email = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) throw new HttpError(401, "Invalid credentials");

  const validPassword = await compare(input.password, user.passwordHash);
  if (!validPassword) throw new HttpError(401, "Invalid credentials");

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    goal: user.goal,
    onboardingDone: user.onboardingDone,
    goalLocked: user.goalLocked,
    role: user.role
  };
}

export async function loginPassword(input: { email: string; password: string }) {
  const email = input.email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) throw new HttpError(401, "Invalid credentials");

  const ok = await compare(input.password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Invalid credentials");

  const token = signAccessToken(user.id, user.role);
  return {
    success: true,
    message: "Login successful",
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      goal: user.goal,
      onboardingDone: user.onboardingDone,
      goalLocked: user.goalLocked,
      role: user.role
    }
  };
}

export async function refreshToken(input: { token: string }) {
  let payload: { sub: string; role?: string };
  try {
    payload = verifyAccessToken(input.token);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, image: true, goal: true, onboardingDone: true, goalLocked: true, role: true }
  });
  if (!user) throw new HttpError(401, "User not found");

  const newToken = signAccessToken(user.id, user.role);
  return {
    success: true,
    token: newToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      goal: user.goal,
      onboardingDone: user.onboardingDone,
      goalLocked: user.goalLocked,
      role: user.role
    }
  };
}

export async function loginGoogle(input: { idToken: string }) {
  const ticket = await googleClient.verifyIdToken({
    idToken: input.idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });

  const g = ticket.getPayload();
  const email = g?.email?.toLowerCase().trim() ?? null;
  if (!email) throw new HttpError(400, "Google account has no email");

  const name = g?.name ?? null;
  const image = g?.picture ?? null;

  const user =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.create({
      data: {
        email,
        name,
        image,
        emailVerified: new Date()
      }
    }));

  const token = signAccessToken(user.id, user.role);
  return {
    success: true,
    message: "Google login successful",
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      goal: user.goal,
      onboardingDone: user.onboardingDone,
      goalLocked: user.goalLocked,
      role: user.role
    }
  };
}

