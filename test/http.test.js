import test from "node:test";
import assert from "node:assert/strict";
import { securityHeaders, sessionCookie } from "../src/lib/http.js";

test("security headers deny framing and indexing helpers", () => {
  const headers = securityHeaders();
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.match(headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(headers.get("referrer-policy"), "no-referrer");
});

test("session cookie is host-only secure httponly strict", () => {
  const cookie = sessionCookie("token");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, /Domain=/);
});
