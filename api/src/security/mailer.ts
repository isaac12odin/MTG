import nodemailer from "nodemailer";

type MailOptions = {
  to: string;
  subject: string;
  text: string;
};

async function sendWithResend(params: { from: string; to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error: ${res.status} ${body}`);
  }

  return true;
}

function createTransport() {
  if (process.env.SMTP_HOST) {
    const pass = process.env.SMTP_PASS || process.env.RESEND_API_KEY;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass }
        : undefined,
    });
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  return nodemailer.createTransport({
    sendmail: true,
    newline: "unix",
    path: process.env.SENDMAIL_PATH ?? "/usr/sbin/sendmail",
  });
}

export async function sendEmail({ to, subject, text }: MailOptions) {
  const logEnabled = process.env.MAILER_LOG === "true";
  const preferSmtp =
    process.env.RESEND_PREFER_SMTP === "true" ||
    (process.env.SMTP_HOST ?? "").includes("resend");
  const resendFrom = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  let from = process.env.MAIL_FROM ?? process.env.GMAIL_USER ?? "";
  if (process.env.RESEND_API_KEY) {
    if (!from || !from.includes("@") || from.includes("localhost")) {
      from = resendFrom;
    }
  }
  if (!from) from = "no-reply@localhost";
  if (logEnabled) {
    // eslint-disable-next-line no-console
    console.info(`📨 [mailer] sending to=${to} subject="${subject}" from=${from}`);
  }
  const usedResend = !preferSmtp
    ? await sendWithResend({ from, to, subject, text }).catch((err) => {
        throw err;
      })
    : false;
  if (!usedResend) {
    const transporter = createTransport();
    const info = await transporter.sendMail({ from, to, subject, text });
    if (logEnabled) {
      // eslint-disable-next-line no-console
      console.info(`📨 [mailer] smtp response=${info.response ?? ""} id=${info.messageId ?? ""}`);
    }
  }
  if (logEnabled) {
    // eslint-disable-next-line no-console
    console.info(`✅ [mailer] sent to=${to}${usedResend ? " via Resend" : ""}`);
  }
}

export async function sendVerifyOtpEmail(to: string, code: string) {
  const subject = "Tu código de verificación";
  const text = `Tu código de verificación es: ${code}\n\nEste código expira en 10 minutos.`;
  try {
    await sendEmail({ to, subject, text });
  } catch (err) {
    const devLog = process.env.MAILER_DEV_LOG_OTP === "true";
    const silent = process.env.MAILER_DEV_FAIL_SILENT === "true";
    // eslint-disable-next-line no-console
    console.warn(`❌ [mailer] failed for ${to}: ${(err as Error)?.message ?? err}`);
    if (devLog) {
      // eslint-disable-next-line no-console
      console.warn(`🔐 [mailer] OTP fallback for ${to}: ${code}`);
    }
    if (silent || devLog) return;
    throw err;
  }
}
