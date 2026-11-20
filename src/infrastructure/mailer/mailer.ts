import { promises as dns } from "node:dns";
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

// Brevo transactional email over HTTPS. Used when BREVO_API_KEY is set — e.g.
// on Render's free plan, which blocks outbound SMTP ports (25/465/587).
// The sender address must be verified in Brevo (Senders & IPs → Senders).
async function sendViaBrevo(apiKey: string, to: string, subject: string, html: string) {
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER;
  if (!senderEmail) {
    throw new Error("BREVO_API_KEY is set but no sender: set BREVO_SENDER_EMAIL to a Brevo-verified address");
  }
  const senderName = process.env.BREVO_SENDER_NAME || "VeganFit";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent: html
    }),
    signal: AbortSignal.timeout(15_000)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo send failed: HTTP ${res.status} ${detail.slice(0, 300)}`);
  }
  const data = (await res.json().catch(() => ({}))) as { messageId?: string };
  return { sent: true, messageId: data.messageId };
}

export async function sendOtpEmail({ to, code, purpose }: OtpEmailPayload) {
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    return sendViaBrevo(brevoKey, to, subjectFor(purpose), htmlFor(purpose, code));
  }

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

  // Some hosts (e.g. Render) have no outbound IPv6. smtp.gmail.com resolves to
  // IPv6 too, and connecting there fails with ENETUNREACH after a long hang.
  // Resolve an IPv4 address ourselves and keep the real hostname for TLS SNI /
  // certificate verification.
  let connectHost = smtpHost;
  try {
    connectHost = (await dns.lookup(smtpHost, { family: 4 })).address;
  } catch {
    // fall back to the hostname and let nodemailer resolve it
  }

  const transporter = nodemailer.createTransport({
    host: connectHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { servername: smtpHost },
    // Fail fast instead of hanging the signup request for minutes.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000
  });

  const info = await transporter.sendMail({
    from: fromEmail,
    to,
    subject,
    html
  });

  return { sent: true, messageId: info.messageId };
}
