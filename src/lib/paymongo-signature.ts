import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPayMongoSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  liveMode: boolean,
  nowMs = Date.now(),
) {
  const parts = Object.fromEntries(signatureHeader.split(",").map(part => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }));
  const timestamp = parts.t;
  const received = liveMode ? parts.li : parts.te;
  if (!timestamp || !received || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp + "." + rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
