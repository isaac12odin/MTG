"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.sendVerifyOtpEmail = sendVerifyOtpEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
function createTransport() {
    if (process.env.SMTP_HOST) {
        return nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: process.env.SMTP_SECURE === "true",
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
        });
    }
    return nodemailer_1.default.createTransport({
        sendmail: true,
        newline: "unix",
        path: process.env.SENDMAIL_PATH ?? "/usr/sbin/sendmail",
    });
}
async function sendEmail({ to, subject, text }) {
    const from = process.env.MAIL_FROM ?? "no-reply@localhost";
    const transporter = createTransport();
    await transporter.sendMail({ from, to, subject, text });
}
async function sendVerifyOtpEmail(to, code) {
    const subject = "Tu código de verificación";
    const text = `Tu código de verificación es: ${code}\n\nEste código expira en 10 minutos.`;
    await sendEmail({ to, subject, text });
}
