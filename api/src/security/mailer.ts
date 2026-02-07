import nodemailer from "nodemailer";

type MailOptions = {
  to: string;
  subject: string;
  text: string;
};

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }

  return nodemailer.createTransport({
    sendmail: true,
    newline: "unix",
    path: process.env.SENDMAIL_PATH ?? "/usr/sbin/sendmail",
  });
}

export async function sendEmail({ to, subject, text }: MailOptions) {
  const from = process.env.MAIL_FROM ?? "no-reply@localhost";
  const transporter = createTransport();
  await transporter.sendMail({ from, to, subject, text });
}

export async function sendVerifyOtpEmail(to: string, code: string) {
  const subject = "Tu código de verificación";
  const text = `Tu código de verificación es: ${code}\n\nEste código expira en 10 minutos.`;
  await sendEmail({ to, subject, text });
}
