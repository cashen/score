import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../src/index.js";
import { routePublicSharingV2 } from "../src/sharing-v2.js";
import { hashPassword, sha256, tokenHash, timingSafeEqualText, verifyPassword } from "../src/lib/crypto.js";
import { enforceRateLimit } from "../src/lib/rate-limit.js";

class MockKV {
  constructor() { this.map = new Map(); }
  async get(key, type) {
    if (!this.map.has(key)) return null;
    const value = this.map.get(key);
    return type === "json" ? JSON.parse(value) : value;
  }
  async put(key, value) { this.map.set(key, String(value)); }
  async delete(key) { this.map.delete(key); }
}

function env() {
  return {
    SCORE_KV: new MockKV(),
    SESSION_SECRET: "session-secret-v127-test",
    AUTH_PEPPER: "auth-pepper-v127-test",
    PASSWORD_ITERATIONS: "100000",
    APP_VERSION: "0.12.28",
    SCHEMA_VERSION: "1",
    ASSETS: { fetch: async () => new Response("<!doctype html><title>Score</title>", { headers: { "content-type": "text/html" } }) }
  };
}

async function call(base, path, options = {}) {
  return worker.fetch(new Request(`https://score.example${path}`, options), base);
}

test("password records support v1 compatibility and v2 metadata", async () => {
  const legacy = await hashPassword("test-password-123", "pepper", 10000, "legacy-salt");
  legacy.version = 1;
  assert.equal(await verifyPassword("test-password-123", "pepper", legacy), true);
  assert.equal(await verifyPassword("wrong-password-123", "pepper", legacy), false);

  const current = await hashPassword("test-password-123", "pepper", 10000, "current-salt");
  await assert.rejects(() => hashPassword("test-password-123", "pepper", 100001, "too-high-salt"), /between 10000 and 100000/);
  assert.equal(current.version, 2);
  assert.equal(current.algorithm, "PBKDF2-SHA256");
  assert.equal(timingSafeEqualText(current.hash, current.hash), true);
  assert.equal(timingSafeEqualText(current.hash, legacy.hash), false);
});

test("domain-separated token hashes require both runtime secrets", async () => {
  const runtime = env();
  const share = await tokenHash("same-token", runtime, "share");
  const recovery = await tokenHash("same-token", runtime, "onboarding");
  assert.notEqual(share, recovery);
  assert.notEqual(share, await sha256("same-token"));
  const changedSession = { ...runtime, SESSION_SECRET: "different-session-secret-v127-test" };
  assert.notEqual(share, await tokenHash("same-token", changedSession, "share"));
});

test("legacy Secret Share links remain readable after token-locator migration", async () => {
  const runtime = env();
  const token = "legacy-share-token-for-v127-0123456789";
  const student = { id: "stu_legacy", deletedAt: null, displayName: "测试孩子", graduationYear: 2027, schoolLabel: null, className: null };
  const exam = {
    id: "exam_legacy",
    name: "月考",
    date: "2026-09-01",
    type: "monthly",
    status: "normal",
    overall: { officialScore: 600, rankings: [] },
    subjects: {}
  };
  await runtime.SCORE_KV.put("student:stu_legacy", JSON.stringify(student));
  await runtime.SCORE_KV.put("exam:stu_legacy:exam_legacy", JSON.stringify(exam));
  await runtime.SCORE_KV.put("exam-index:stu_legacy", JSON.stringify({ items: [{ id: "exam_legacy", name: "月考", date: "2026-09-01", updatedAt: "2026-09-01" }] }));
  await runtime.SCORE_KV.put(`share:secret:${await sha256(token)}`, JSON.stringify({
    schemaVersion: 2,
    studentId: "stu_legacy",
    kind: "secret",
    mode: "live",
    scope: "single",
    examId: "exam_legacy",
    fields: { displayName: true, graduationYear: true, school: false, className: false, overallScore: true, overallRank: true, subjectScores: false, subjectRanks: false, history: false, examStatus: false, comparisonContext: false, status: false, comparison: false },
    expiresAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    locator: await sha256(token)
  }));
  const response = await routePublicSharingV2(new Request(`https://score.example/api/share/secret/${encodeURIComponent(token)}`), runtime);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.exams.length, 1);
  assert.equal(payload.data.exams[0].name, "月考");
});

test("successful login lazily upgrades a legacy password record", async () => {
  const runtime = env();
  const password = await hashPassword("legacy-login-123", runtime.AUTH_PEPPER, 10000, "legacy-login-salt");
  password.version = 1;
  const member = { schemaVersion: 1, id: "mem_legacy", familyId: "fam_legacy", username: "legacy001", role: "owner", password, sessionVersion: 1, disabledAt: null };
  await runtime.SCORE_KV.put(`username:${await sha256("legacy001")}`, JSON.stringify({ memberId: member.id }));
  await runtime.SCORE_KV.put(`member:${member.id}`, JSON.stringify(member));

  const response = await call(runtime, "/api/login", {
    method: "POST",
    headers: { "content-type": "application/json", "CF-Connecting-IP": "127.0.0.10" },
    body: JSON.stringify({ username: "legacy001", password: "legacy-login-123" })
  });
  assert.equal(response.status, 200);
});

test("rate limiting blocks after the configured identity threshold", async () => {
  const runtime = env();
  const request = () => new Request("https://score.example/api/test", { headers: { "CF-Connecting-IP": "127.0.0.11" } });
  for (let i = 0; i < 3; i += 1) {
    await enforceRateLimit(runtime, request(), { scope: "unit", identity: "one", identityMax: 3, ipMax: 10, windowSeconds: 60 });
  }
  await assert.rejects(
    enforceRateLimit(runtime, request(), { scope: "unit", identity: "one", identityMax: 3, ipMax: 10, windowSeconds: 60 }),
    (error) => error?.status === 429 && error?.code === "rate_limited"
  );
});

test("security configuration and source contracts stay explicit", async () => {
  const [wrangler, index, onboarding, sharing] = await Promise.all([
    readFile(new URL("../wrangler.toml", import.meta.url), "utf8"),
    readFile(new URL("../src/index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/onboarding.js", import.meta.url), "utf8"),
    readFile(new URL("../src/sharing-v2.js", import.meta.url), "utf8")
  ]);
  assert.match(wrangler, /PASSWORD_ITERATIONS\s*=\s*"100000"/);
  assert.equal((await readFile(new URL("../package.json", import.meta.url), "utf8")).includes('"version": "0.12.28.7"'), true);
  assert.match(index, /DUMMY_PASSWORD_RECORD/);
  assert.match(index, /passwordHashUpgradedAt/);
  assert.match(index, /scope: "login"/);
  assert.match(onboarding, /scope: "invite-accept"/);
  assert.match(onboarding, /timingSafeEqualText/);
  assert.match(sharing, /tokenHash\(rawToken, env, "share"\)/);
  assert.match(sharing, /await sha256\(rawLocator\)/);
  assert.doesNotMatch(index, /console\.(log|info|debug).*password/i);
  assert.doesNotMatch(onboarding, /console\.(log|info|debug).*recoveryCode/i);
});