import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, randomToken, signSession, verifyPassword, verifySessionToken } from "../src/lib/crypto.js";

test("password verification accepts correct password and rejects wrong password", async () => {
  const record = await hashPassword("a-strong-family-password", "server-pepper", 50000);
  assert.equal(await verifyPassword("a-strong-family-password", "server-pepper", record), true);
  assert.equal(await verifyPassword("wrong-password", "server-pepper", record), false);
});

test("signed sessions detect tampering and expiry", async () => {
  const payload = { sub: "member", fid: "family", sv: 1, csrf: randomToken(12), exp: Date.now() + 60000 };
  const token = await signSession(payload, "session-secret");
  assert.equal((await verifySessionToken(token, "session-secret")).sub, "member");
  assert.equal(await verifySessionToken(`${token}x`, "session-secret"), null);
  const expired = await signSession({ ...payload, exp: Date.now() - 1 }, "session-secret");
  assert.equal(await verifySessionToken(expired, "session-secret"), null);
});
