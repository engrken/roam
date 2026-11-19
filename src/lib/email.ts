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
    html: `<div style="margin:0;background:#f3f6fb;padding:36px 16px;font-family:Arial,sans-serif;color:#14233b"><div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;padding:32px"><div style="font-size:25px;font-weight:800;letter-spacing:3px;color:#14233b">ROAM</div><p style="color:#526176">Use this one-time code to securely sign in.</p><div style="margin:24px 0;padding:18px;text-align:center;border:1px dashed #9bb6d8;border-radius:12px;background:#f1f6fc;font-size:34px;font-weight:800;letter-spacing:9px;color:#1769aa">${code}</div><p style="font-size:13px;color:#66758a">This code expires in 5 minutes. Never share it with anyone.</p><p style="font-size:12px;color:#8793a3">Move More. Manage Smarter.</p></div></div>`,
  });
}

export async function sendTeamInvitation(email: string, tenantName: string, role: string, invitationUrl: string) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Email sender is not configured.");
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  };
  const safeTenantName = tenantName.replace(/[&<>"']/g, character => htmlEscapes[character] || character);
  const safeRole = role.toLowerCase();
  await getTransport().sendMail({
    from,
    to: email,
    subject: "You're invited to join " + tenantName + " on ROAM",
    text: "You have been invited to join " + tenantName + " as " + safeRole + ". Open this link to accept the invitation: " + invitationUrl + ". The link expires in 7 days.",
    html: `<div style="margin:0;background:#f3f6fb;padding:36px 16px;font-family:Arial,sans-serif;color:#14233b"><div style="max-width:480px;margin:auto;background:#fff;border-radius:16px;padding:32px"><div style="font-size:25px;font-weight:800;letter-spacing:3px;color:#14233b">ROAM</div><h2>You're invited</h2><p style="color:#526176">You've been invited to join <strong>${safeTenantName}</strong> as <strong>${safeRole}</strong>.</p><p style="margin:28px 0"><a href="${invitationUrl}" style="display:inline-block;background:#1769aa;color:#fff;text-decoration:none;padding:13px 20px;border-radius:9px;font-weight:700">Accept invitation</a></p><p style="font-size:13px;color:#66758a">This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.</p></div></div>`,
  });
}


type BookingMessageNotice = {
  recipient: string;
  tenantName: string;
  bookingReference: string;
  senderLabel: "Customer" | "Rental team";
  message: string;
  workspaceUrl?: string;
};

export async function sendBookingMessageNotification(input: BookingMessageNotice) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Email sender is not configured.");
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
  const safeTenant = escapeHtml(input.tenantName);
  const safeMessage = escapeHtml(input.message);
  const safeReference = escapeHtml(input.bookingReference);
  const subject = input.senderLabel + " sent a message about booking " + input.bookingReference;
  const destination = input.workspaceUrl
    ? "Open your ROAM workspace to reply: " + input.workspaceUrl
    : "To reply, open the private ROAM booking portal link originally provided when you submitted your booking request.";
  const link = input.workspaceUrl
    ? '<p style="margin:24px 0"><a href="' + escapeHtml(input.workspaceUrl) + '" style="display:inline-block;background:#087e9b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Open conversation</a></p>'
    : "";
  await getTransport().sendMail({
    from,
    to: input.recipient,
    subject,
    text: input.senderLabel + " sent a message about booking " + input.bookingReference + " with " + input.tenantName + ".\n\n" + input.message + "\n\n" + destination,
    html: '<div style="background:#f3f6fb;padding:32px 16px;font-family:Arial,sans-serif;color:#14233b"><div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:28px"><div style="font-size:22px;font-weight:800;letter-spacing:2px">ROAM</div><p style="color:#526176">' + escapeHtml(input.senderLabel) + ' sent a message to ' + safeTenant + ' about booking <strong>' + safeReference + '</strong>.</p><div style="margin:20px 0;padding:16px;border-radius:10px;background:#f3f6fb;white-space:pre-wrap;overflow-wrap:anywhere">' + safeMessage + '</div>' + link + '<p style="font-size:13px;color:#66758a">' + escapeHtml(destination) + '</p></div></div>',
  });
}
