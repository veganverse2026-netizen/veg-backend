import { prisma } from "../../infrastructure/db/prisma.js";
import crypto from "crypto";

/**
 * Short, URL-friendly referral code assigned to every user at creation.
 * Collisions are astronomically unlikely at this alphabet/length for a
 * consumer app's user count, but we still retry on the rare unique-
 * constraint race rather than trust probability alone.
 */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomBytes(5).toString("hex").slice(0, 8);
    const existing = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique referral code after 5 attempts");
}

/**
 * Resolves an incoming referral code (from a signup link/field) to the
 * referring user's id, or undefined if the code doesn't match anyone — a
 * typo'd or made-up code should never block signup, it should just silently
 * not attribute a referral.
 */
export async function resolveReferrerId(code: string | undefined): Promise<string | undefined> {
  if (!code) return undefined;
  const referrer = await prisma.user.findUnique({ where: { referralCode: code.trim() }, select: { id: true } });
  return referrer?.id ?? undefined;
}
