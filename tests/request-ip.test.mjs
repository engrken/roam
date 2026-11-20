import test from "node:test";
import assert from "node:assert/strict";
import { getClientIp } from "../src/lib/request-ip.ts";

test("prefers the proxy-provided real IP header", () => {
  const headers = new Headers({ "x-real-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.1, 203.0.113.8" });
  assert.equal(getClientIp(headers), "203.0.113.8");
});

test("uses the final forwarded address when real IP is unavailable", () => {
  const headers = new Headers({ "x-forwarded-for": "198.51.100.1, 203.0.113.8" });
  assert.equal(getClientIp(headers), "203.0.113.8");
});

test("returns unknown when no client IP headers are available", () => {
  assert.equal(getClientIp(new Headers()), "unknown");
});
