import crypto from "crypto";

export function generateOtpCode() {
	return String(Math.floor(100000 + Math.random() * 400000));
}

export function hashOtpCode(code: string) {
	return crypto.createHash("sha256").update(code).digest("hex");
}

export function safeEqualHash(a: string, b: string) {
	const aa = Buffer.from(a, "hex");
	const bb = Buffer.from(b, "hex");
	if (aa.length !== bb.length) return false;
	return crypto.timingSafeEqual(aa, bb);
}

export function otpExpiry(minutes = 10) {
	return new Date(Date.now() + minutes * 60 * 1000);
}
