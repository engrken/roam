import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";
import { prisma } from "@/lib/prisma";

const b64u = (value: Buffer) => value.toString("base64url");
const fromB64u = (value: string) => Buffer.from(value, "base64url");
const hmac = (key: Buffer, value: Buffer | string) => createHmac("sha256", key).update(value).digest();
function hkdfExpand(prk: Buffer, info: Buffer | string, length: number) {
  let previous = Buffer.alloc(0); const chunks: Buffer[] = []; let counter = 1;
  while (Buffer.concat(chunks).length < length) { previous = hmac(prk, Buffer.concat([previous, Buffer.from(info), Buffer.from([counter++])])); chunks.push(previous); }
  return Buffer.concat(chunks).subarray(0, length);
}
function vapidKeys() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "";
  const privateBytes = fromB64u(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "");
  if (publicKey.length < 80 || privateBytes.length !== 32) throw new Error("Browser push is not configured.");
  const ecdh = createECDH("prime256v1"); ecdh.setPrivateKey(privateBytes);
  const publicBytes = ecdh.getPublicKey(undefined, "uncompressed");
  const privateKey = createPrivateKey({ key: { kty: "EC", crv: "P-256", d: b64u(privateBytes), x: b64u(publicBytes.subarray(1,33)), y: b64u(publicBytes.subarray(33,65)) }, format: "jwk" });
  return { publicKey, privateBytes, privateKey };
}
function vapidToken(audience: string, privateKey: ReturnType<typeof createPrivateKey>) {
  const encode = (value: unknown) => b64u(Buffer.from(JSON.stringify(value)));
  const header = encode({ typ: "JWT", alg: "ES256" });
  const payload = encode({ aud: audience, exp: Math.floor(Date.now()/1000)+12*60*60, sub: process.env.WEB_PUSH_SUBJECT || "mailto:support@roamph.vercel.app" });
  const unsigned = header + "." + payload;
  const signature = sign("sha256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return unsigned + "." + b64u(signature);
}
function encryptPayload(subscription: { p256dh: string; auth: string }, payload: string) {
  const clientPublic = fromB64u(subscription.p256dh);
  const authSecret = fromB64u(subscription.auth);
  const ephemeral = createECDH("prime256v1"); ephemeral.generateKeys();
  const serverPublic = ephemeral.getPublicKey(undefined, "uncompressed");
  const shared = ephemeral.computeSecret(clientPublic);
  const authPrk = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), clientPublic, serverPublic]);
  const ikm = hkdfExpand(authPrk, keyInfo, 32);
  const salt = randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hkdfExpand(prk, "Content-Encoding: aes128gcm\0", 16);
  const nonce = hkdfExpand(prk, "Content-Encoding: nonce\0", 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const plaintext = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0); header.writeUInt32BE(4096, 16); header[20] = serverPublic.length;
  return Buffer.concat([header, serverPublic, encrypted]);
}
async function sendOne(row: { id: string; endpoint: string; p256dh: string; auth: string }, payload: string) {
  try {
    const url = new URL(row.endpoint);
    const keys = vapidKeys();
    const authorization = "vapid t=" + vapidToken(url.origin, keys.privateKey) + ", k=" + keys.publicKey;
    const response = await fetch(row.endpoint, { method: "POST", headers: { Authorization: authorization, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high" }, body: encryptPayload(row, payload) });
    if (response.status === 404 || response.status === 410) await prisma.webPushSubscription.delete({ where: { id: row.id } }).catch(() => undefined);
    if (!response.ok && response.status !== 404 && response.status !== 410) console.error("Web Push delivery failed", response.status);
  } catch (error) { console.error("Web Push delivery failed", error); }
}
export async function notifyTenant(tenantId: string, title: string, body: string, url: string) {
  if (!process.env.WEB_PUSH_VAPID_PUBLIC_KEY || !process.env.WEB_PUSH_VAPID_PRIVATE_KEY) return;
  const rows = await prisma.webPushSubscription.findMany({ where: { tenantId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  await Promise.all(rows.map(row => sendOne(row, JSON.stringify({ title, body, url, icon: "/favicon.svg", badge: "/favicon.svg" }))));
}
export async function notifyBooking(bookingId: string, title: string, body: string, url: string) {
  if (!process.env.WEB_PUSH_VAPID_PUBLIC_KEY || !process.env.WEB_PUSH_VAPID_PRIVATE_KEY) return;
  const rows = await prisma.webPushSubscription.findMany({ where: { bookingId }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  await Promise.all(rows.map(row => sendOne(row, JSON.stringify({ title, body, url, icon: "/favicon.svg", badge: "/favicon.svg" }))));
}
export function getVapidPublicKey() { return process.env.WEB_PUSH_VAPID_PUBLIC_KEY || ""; }
