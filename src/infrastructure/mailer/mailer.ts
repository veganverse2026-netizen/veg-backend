import nodemailer from "nodemailer";

type OtpEmailPayload = {
  to: string;
  code: string;
  purpose: "SIGNUP" | "LOGIN" | "RESET";
};

function subjectFor(purpose: OtpEmailPayload["purpose"]) {
  if (purpose === "SIGNUP") return "VeganFit signup verification code";
  if (purpose === "LOGIN") return "VeganFit login verification code";
  return "VeganFit password reset code";
}

function htmlFor(purpose: OtpEmailPayload["purpose"], code: string) {
  const headline = purpose === "RESET" ? "Reset your password" : "VeganFit Security Code";
  const intro =
    purpose === "SIGNUP"
      ? "Use this one-time code to verify your email and finish creating your VeganFit account:"
      : purpose === "LOGIN"
        ? "Use this one-time code to confirm your login:"
        : "Use this one-time code to reset your VeganFit password:";

  const safety =
    purpose === "RESET"
      ? "If you didn't request a password reset, you can ignore this email and your password will stay the same."
      : "If you did not request this, you can safely ignore this email.";

  return `
    <div style="font-family: Inter, Arial, sans-serif; line-height:1.5; color:#1C1F23;">
      <h2 style="margin-bottom:8px;">${headline}</h2>
      <p>${intro}</p>
      <div style="font-size:28px; letter-spacing:6px; font-weight:700; margin:14px 0; color:#2F6F4E;">${code}</div>
      <p>This code expires in 10 minutes.</p>
      <p>${safety}</p>
    </div>
  `;
}

export async function sendOtpEmail({ to, code, purpose }: OtpEmailPayload) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure = (process.env.SMTP_SECURE ?? "").toLowerCase() === "true";

  const fromEmail = process.env.AUTH_FROM_EMAIL || "VeganFit <noreply@veganfit.app>";

  const subject = subjectFor(purpose);
  const html = htmlFor(purpose, code);

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is not configured. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS");
    }

    // eslint-disable-next-line no-console
    console.info(`[AUTH OTP] ${purpose} code for ${to}: ${code}`);
    return { sent: false, reason: "OTP logged to server console (dev mode). Configure SMTP_* to send emails." };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass }
  });

  const info = await transporter.sendMail({
    from: fromEmail,
    to,
    subject,
    html
  });

  return { sent: true, messageId: info.messageId };
}
