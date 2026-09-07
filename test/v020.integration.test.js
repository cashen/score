import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/v020.js";

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

function makeEnv() {
  return {
    SCORE_KV: new MockKV(),
    SESSION_SECRET: "session-secret-for-v020-tests",
    AUTH_PEPPER: "pepper-for-v020-tests",
    ADMIN_BOOTSTRAP_SECRET: "admin-secret",
    PASSWORD_ITERATIONS: "10000",
    APP_VERSION: "0.2.0",
    SCHEMA_VERSION: "1",
    ASSETS: { fetch: async () => new Response("<!doctype html><title>Score</title>", { headers: { "content-type": "text/html" } }) }
  };
}

async function call(env, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return worker.fetch(new Request(`https://score.example${path}`, { ...options, headers }), env);
}

function cookie(response) {
  return (response.headers.get("set-cookie") || "").split(";")[0];
}

async function rootAccount(env) {
  let response = await call(env, "/api/admin/provision", {
    method: "POST",
    headers: { authorization: "Bearer admin-secret" },
    body: JSON.stringify({ familyName: "根家庭", username: "root001", password: "root-password-123", student: { displayName: "根孩子" } })
  });
  assert.equal(response.status, 201);
  const provision = await response.json();
  response = await call(env, "/api/login", { method: "POST", body: JSON.stringify({ username: "root001", password: "root-password-123" }) });
  assert.equal(response.status, 200);
  const rootCookie = cookie(response);
  const login = await response.json();
  return { provision, cookie: rootCookie, csrf: login.csrf };
}

async function createExam(env, session, studentId, exam) {
  const response = await call(env, `/api/students/${studentId}/exams`, {
    method: "POST",
    headers: { cookie: session.cookie, "x-score-csrf": session.csrf, origin: "https://score.example" },
    body: JSON.stringify({
      name: exam.name,
      date: exam.date,
      type: "monthly",
      overall: { officialScore: exam.score, rankings: [{ scope: "school", label: "学校", rank: exam.rank, participants: exam.participants }] },
      subjects: { math: { fullScore: 150, rawScore: exam.math, finalScore: exam.math, scoreMode: "raw", rankings: [{ scope: "school", label: "学校", rank: exam.mathRank, participants: exam.participants }] } }
    })
  });
  assert.equal(response.status, 201);
  return (await response.json()).exam;
}

test("single-exam share stays pinned while trajectory share includes multiple exams", async () => {
  const env = makeEnv();
  const root = await rootAccount(env);
  const first = await createExam(env, root, root.provision.studentId, { name: "9月月考", date: "2026-09-01", score: 570, rank: 180, participants: 1000, math: 110, mathRank: 210 });
  await createExam(env, root, root.provision.studentId, { name: "10月联考", date: "2026-10-01", score: 590, rank: 130, participants: 1000, math: 125, mathRank: 145 });

  let response = await call(env, `/api/students/${root.provision.studentId}/shares`, {
    method: "POST",
    headers: { cookie: root.cookie, "x-score-csrf": root.csrf, origin: "https://score.example" },
    body: JSON.stringify({ kind: "public", slug: "one", mode: "live", scope: "single", examId: first.id, fields: { overallScore: true, overallRank: true, subjectScores: true, subjectRanks: true } })
  });
  assert.equal(response.status, 201);
  const single = await response.json();
  assert.equal(single.share.scope, "single");
  assert.equal(single.share.examId, first.id);

  response = await call(env, "/api/share/public/one");
  assert.equal(response.status, 200);
  let external = await response.json();
  assert.equal(external.share.scope, "single");
  assert.equal(external.data.exams.length, 1);
  assert.equal(external.data.exams[0].name, "9月月考");

  response = await call(env, `/api/students/${root.provision.studentId}/shares`, {
    method: "POST",
    headers: { cookie: root.cookie, "x-score-csrf": root.csrf, origin: "https://score.example" },
    body: JSON.stringify({ kind: "secret", mode: "live", scope: "trajectory", fields: { history: true, overallScore: true, overallRank: true, subjectScores: true, subjectRanks: true } })
  });
  assert.equal(response.status, 201);
  const trajectory = await response.json();
  assert.equal(trajectory.share.scope, "trajectory");
  response = await call(env, `/api/share/secret/${trajectory.token}`);
  assert.equal(response.status, 200);
  external = await response.json();
  assert.equal(external.share.scope, "trajectory");
  assert.deepEqual(external.data.exams.map((exam) => exam.name), ["10月联考", "9月月考"]);
});

test("invited family is isolated and recovery rotates password, code and sessions", async () => {
  const env = makeEnv();
  const root = await rootAccount(env);

  let response = await call(env, "/api/admin/invitations", {
    method: "POST",
    headers: { cookie: root.cookie, "x-score-csrf": root.csrf, origin: "https://score.example" },
    body: JSON.stringify({ expiresInHours: 72 })
  });
  assert.equal(response.status, 201);
  const invite = await response.json();
  assert.ok(invite.token.length > 20);

  response = await call(env, `/api/invitations/${invite.token}`);
  assert.equal(response.status, 200);

  response = await call(env, `/api/invitations/${invite.token}/accept`, {
    method: "POST",
    body: JSON.stringify({ familyName: "独立家庭", username: "guest001", password: "guest-password-123", student: { displayName: "独立孩子", schoolLabel: "另一所学校" } })
  });
  assert.equal(response.status, 201);
  const acceptedCookie = cookie(response);
  const accepted = await response.json();
  const originalRecoveryCode = accepted.recoveryCode;
  assert.ok(originalRecoveryCode.length > 20);
  assert.notEqual(accepted.familyId, root.provision.familyId);

  response = await call(env, `/api/students/${accepted.studentId}/exams`, { headers: { cookie: root.cookie } });
  assert.equal(response.status, 404);

  response = await call(env, "/api/admin/invitations", { headers: { cookie: acceptedCookie } });
  assert.equal(response.status, 403);

  response = await call(env, "/api/recovery/code", {
    method: "POST",
    body: JSON.stringify({ username: "guest001", recoveryCode: originalRecoveryCode, newPassword: "guest-new-password-123" })
  });
  assert.equal(response.status, 200);
  const recovered = await response.json();
  assert.notEqual(recovered.recoveryCode, originalRecoveryCode);

  response = await call(env, "/api/me", { headers: { cookie: acceptedCookie } });
  assert.equal(response.status, 401);
  response = await call(env, "/api/login", { method: "POST", body: JSON.stringify({ username: "guest001", password: "guest-password-123" }) });
  assert.equal(response.status, 401);
  response = await call(env, "/api/login", { method: "POST", body: JSON.stringify({ username: "guest001", password: "guest-new-password-123" }) });
  assert.equal(response.status, 200);

  response = await call(env, "/api/recovery/code", {
    method: "POST",
    body: JSON.stringify({ username: "guest001", recoveryCode: originalRecoveryCode, newPassword: "should-not-work-123" })
  });
  assert.equal(response.status, 403);

  response = await call(env, "/api/admin/recovery-links", {
    method: "POST",
    headers: { cookie: root.cookie, "x-score-csrf": root.csrf, origin: "https://score.example" },
    body: JSON.stringify({ username: "guest001" })
  });
  assert.equal(response.status, 201);
  const resetLink = await response.json();
  assert.ok(resetLink.token.length > 20);

  response = await call(env, `/api/recovery/reset/${resetLink.token}`, { method: "POST", body: JSON.stringify({ newPassword: "guest-final-password-123" }) });
  assert.equal(response.status, 200);
  const finalReset = await response.json();
  assert.ok(finalReset.recoveryCode.length > 20);

  response = await call(env, `/api/recovery/reset/${resetLink.token}`, { method: "POST", body: JSON.stringify({ newPassword: "reuse-must-fail-123" }) });
  assert.equal(response.status, 404);
  response = await call(env, "/api/login", { method: "POST", body: JSON.stringify({ username: "guest001", password: "guest-final-password-123" }) });
  assert.equal(response.status, 200);
});
