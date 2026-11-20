import nodemailer from "nodemailer";

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_APP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_APP_PASSWORD) {
    throw new Error("Email service is not configured.");
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_APP_PASSWORD },
  });
}

export async function sendLoginCode(email: string, code: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Email sender is not configured.");
  await getTransport().sendMail({
    from,
    to: email,
    subject: "Your ROAM sign-in code",
    text: `Your ROAM verification code is ${code}. It expires in 5 minutes. If you did not request this code, you can ignore this email.`,
    html: `<div style="margin:0;background:#f3f6fb;padding:36px 16px;font-family:Arial,sans-serif;color:#14233b"><div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;padding:32px"><div style="font-size:25px;font-weight:800;letter-spacing:3px;color:#14233b">ROAM</div><p style="color:#526176">Use this one-time code to securely sign in.</p><div style="margin:24px 0;padding:18px;text-align:center;border:1px dashed #9bb6d8;border-radius:12px;background:#f1f6fc;font-size:34px;font-weight:800;letter-spacing:9px;color:#1769aa">${code}</div><p style="font-size:13px;color:#66¶»§q«^