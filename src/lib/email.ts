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

export async function sendBookingReminder(input: {
  recipient: string;
  tenantName: string;
  bookingReference: string;
  reminderType: "PICKUP" | "RETURN" | "OVERDUE";
  startAt: Date;
  endAt: Date;
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Email sender is not configured.");
  const labels = {
    PICKUP: ["Your rental pickup is coming up", "Your vehicle pickup is scheduled for"],
    RETURN: ["Your rental return is coming up", "Your vehicle return is scheduled for"],
    OVERDUE: ["Your rental return is overdue", "Our records show your rental was due back on"],
  } as const;
  const [subject, lead] = labels[input.reminderType];
  const dateTime = (value: Date) => value.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "long", timeStyle: "short" });
  const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
  const text = `Hello,\n\n${lead} ${dateTime(input.reminderType === "PICKUP" ? input.startAt : input.endAt)}.\nBooking reference: ${input.bookingReference}\nRental business: ${input.tenantName}\n\nIf you have questions or need to coordinate a change, please contact the rental business directly.\n\nThank you.\nROAM`;
  await getTransport().sendMail({
    from, to: input.recipient, subject: `${subject} · ${input.bookingReference}`, text,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033;line-height:1.6"><h2>${safe(subject)}</h2><p>${safe(lead)} <strong>${safe(dateTime(input.reminderType === "PICKUP" ? input.startAt : input.endAt))}</strong>.</p><p><strong>Booking:</strong> ${safe(input.bookingReference)}<br/><strong>Rental business:</strong> ${safe(input.tenantName)}</p><p>If you have questions or need to coordinate a change, please contact the rental business directly.</p><p>Thank you,<br/>ROAM</p></div>`,
  });
}


export async function sendBookingStatusNotification(input: {
  recipient: string;
  tenantName: string;
  bookingReference: string;
  status: string;
  startAt: Date;
  endAt: Date;
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Email sender is not configured.");
  const labels: Record<string, string> = {
    PENDING: "Booking request received",
    CONFIRMED: "Your booking is confirmed",
    ACTIVE: "Your rental is now in progress",
    COMPLETED: "Your rental has been completed",
    CANCELLED: "Your booking has been cancelled",
    REJECTED: "Your booking request was not approved",
  };
  const heading = labels[input.status] || "Your booking has been updated";
  const safe = (value: string) => value.replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
  const format = (value: Date) => value.toLocaleString("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "long", timeStyle: "short",
  });
  const text = [
    "Hello,",
    "",
    heading + ".",
    "Booking reference: " + input.bookingReference,
    "Rental business: " + input.tenantName,
    "Pickup: " + format(input.startAt),
    "Return: " + format(input.endAt),
    "",
    "For private booking details or to message the rental team, please use the private booking link you received when you submitted your request.",
    "",
    "Thank you.",
    "ROAM",
  ].join("\n");
  await getTransport().sendMail({
    from,
    to: input.recipient,
    subject: heading + " · " + input.bookingReference,
    text,
    html: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#172033;line-height:1.6"><h2>' + safe(heading) + '</h2><p>Your booking with <strong>' + safe(input.tenantName) + '</strong> has been updated.</p><p><strong>Reference:</strong> ' + safe(input.bookingReference) + '<br/><strong>Pickup:</strong> ' + safe(format(input.startAt)) + '<br/><strong>Return:</strong> ' + safe(format(input.endAt)) + '</p><p>For private booking details or to message the rental team, please use the private booking link you received when you submitted your request.</p><p>Thank you,<br/>ROAM</p></div>',
  });
}

export async function sendBookingRequestReceived(input: {
  recipient: string;
  tenantName: string;
  bookingReference: string;
  startAt: Date;
  endAt: Date;
  bookingUrl: string;
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Email sender is not configured.");
  const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
  const format = (value: Date) => value.toLocaleString("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "long", timeStyle: "short",
  });
  const pickup = format(input.startAt);
  const returnAt = format(input.endAt);
  const subject = "Booking request received · " + input.bookingReference;
  await getTransport().sendMail({
    from,
    to: input.recipient,
    subject,
    text: [
      "Hello,",
      "",
      "Your booking request has been received by " + input.tenantName + ". The rental team will review it and update you.",
      "Booking reference: " + input.bookingReference,
      "Pickup: " + pickup,
      "Return: " + returnAt,
      "",
      "View your private booking, upload documents, and message the rental team:",
      input.bookingUrl,
      "",
      "Keep this link private. Anyone with it can access your booking portal.",
      "",
      "Thank you,",
      "ROAM",
    ].join("\n"),
    html: '<div style="background:#f3f6fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033;line-height:1.6"><div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:28px"><div style="font-size:22px;font-weight:800;letter-spacing:2px">ROAM</div><h2>Your booking request was received</h2><p>The rental team at <strong>' + safe(input.tenantName) + '</strong> will review your request and update you.</p><p><strong>Reference:</strong> ' + safe(input.bookingReference) + '<br/><strong>Pickup:</strong> ' + safe(pickup) + '<br/><strong>Return:</strong> ' + safe(returnAt) + '</p><p style="margin:24px 0"><a href="' + safe(input.bookingUrl) + '" style="display:inline-block;background:#087e9b;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:700">View my booking</a></p><p>You can use your private booking portal to view updates, upload documents, and message the rental team.</p><p style="font-size:13px;color:#66758a">Keep this link private. Anyone with it can access your booking portal.</p></div></div>',
  });
}

export async function sendBookingAccessLink(input: {
  recipient: string;
  bookingReference: string;
  bookingUrl: string;
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Email sender is not configured.");
  const safe = (value: string) => value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
  await getTransport().sendMail({
    from,
    to: input.recipient,
    subject: "Your ROAM booking access link · " + input.bookingReference,
    text: [
      "Hello,",
      "",
      "We received a request to access booking " + input.bookingReference + ".",
      "Use this private link to view your booking, upload documents, and message the rental team:",
      input.bookingUrl,
      "",
      "This link grants access to your booking. Keep it private.",
      "If you did not request this, you can ignore this email.",
      "",
      "ROAM",
    ].join("\n"),
    html: '<div style="background:#f3f6fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033;line-height:1.6"><div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:28px"><div style="font-size:22px;font-weight:800;letter-spacing:2px">ROAM</div><h2>Your booking access link</h2><p>We received a request to access booking <strong>' + safe(input.bookingReference) + '</strong>.</p><p style="margin:24px 0"><a href="' + safe(input.bookingUrl) + '" style="display:inline-block;background:#087e9b;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:700">View my booking</a></p><p style="font-size:13px;color:#66758a">This private link grants access to your booking. Keep it safe. If you did not request this, you can ignore this email.</p></div></div>',
  });
}

export async function sendTrialLifecycleEmail(input: {
  recipient: string;
  tenantName: string;
  stage: "REMINDER" | "EXPIRED" | "READ_ONLY";
  trialEndsAt: Date;
  accountUrl: string;
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Email sender is not configured.");
  const safe = (value: string) => value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
  const date = input.trialEndsAt.toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "long" });
  const content = {
    REMINDER: {
      subject: "Your ROAM trial ends in 3 days",
      heading: "Your trial ends soon",
      message: "Your 14-day ROAM trial ends on " + date + ". You will have a further 7-day grace period to request and arrange a paid plan. Your workspace remains operational during that grace period.",
    },
    EXPIRED: {
      subject: "Your ROAM trial has ended",
      heading: "Your trial has ended",
      message: "Your trial ended on " + date + ". Your workspace remains fully operational during the 7-day grace period. Please review your subscription options before the grace period ends.",
    },
    READ_ONLY: {
      subject: "Your ROAM workspace is now read-only",
      heading: "Your grace period has ended",
      message: "Your ROAM workspace is now read-only. You can still sign in and view existing bookings, customers, documents and financial records. Request a paid plan and wait for platform admin approval to restore editing access.",
    },
  }[input.stage];
  await getTransport().sendMail({
    from,
    to: input.recipient,
    subject: content.subject,
    text: "Hello,\n\n" + content.message + "\n\nReview your account: " + input.accountUrl + "\n\nROAM",
    html: '<div style="background:#f3f6fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033;line-height:1.6"><div style="max-width:560px;margin:auto;background:#fff;border-radius:14px;padding:28px"><div style="font-size:22px;font-weight:800;letter-spacing:2px">ROAM</div><h2>' + safe(content.heading) + '</h2><p>Hello ' + safe(input.tenantName) + ',</p><p>' + safe(content.message) + '</p><p style="margin:24px 0"><a href="' + safe(input.accountUrl) + '" style="display:inline-block;background:#087e9b;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:700">Open account & subscription</a></p><p style="font-size:13px;color:#66758a">Your existing business data is retained. ROAM does not automatically charge your payment method.</p></div></div>',
  });
}


export async function sendReferralRewardEmail(input: {
  recipient: string;
  businessName: string;
  referredBusinessName: string;
  accountUrl: string;
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error("Email sender is not configured.");
  const safe = (value: string) => value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
  const subject = "You earned one month free on ROAM!";
  const text = [
    "Good news!",
    "",
    "Your referral with " + input.referredBusinessName + " has qualified. Your workspace, " + input.businessName + ", has received one free month of ROAM.",
    "",
    "Your referral partner also received one free month.",
    "View your account and subscription: " + input.accountUrl,
    "",
    "Thank you for helping more rental businesses discover ROAM.",
  ].join("\n");
  await getTransport().sendMail({
    from, to: input.recipient, subject, text,
    html: '<div style="background:#f3f6fb;padding:32px 16px;font-family:Arial,sans-serif;color:#172033;line-height:1.6"><div style="max-width:540px;margin:auto;background:#fff;border-radius:14px;padding:28px"><div style="font-size:22px;font-weight:800;letter-spacing:2px">ROAM</div><h2>You earned one month free!</h2><p>Your referral with <strong>' + safe(input.referredBusinessName) + '</strong> has qualified. Your workspace, <strong>' + safe(input.businessName) + '</strong>, has received one free month of ROAM.</p><p>Your referral partner also received one free month.</p><p style="margin:24px 0"><a href="' + safe(input.accountUrl) + '" style="display:inline-block;background:#087e9b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">View account & subscription</a></p><p style="font-size:13px;color:#66758a">Thank you for helping more rental businesses discover ROAM.</p></div></div>',
  });
}
