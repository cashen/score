import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

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
    SESSION_SECRET: "session-secret-for-tests-only",
    AUTH_PEPPER: "pepper-for-tests-only",
    ADMIN_BOOTSTRAP_SECRET: "admin-secret",
    PASSWORD_ITERATIONS: "10000",
    APP_VERSION: "test",
    SCHEMA_VERSION: "1",
    ASSETS: { fetch: async () => new Response("<!doctype html><title>Score</title>", { headers: { "content-type": "text/html" } }) }
  };
}

async function call(e, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return worker.fetch(new Request(`https://score.example${path}`, { ...options, headers }), e);
}

function cookieFrom(response) {
  return (response.headers.get("set-cookie") || "").split(";")[0];
}

test("provision -> login -> create exam -> secret share keeps notes private", async () => {
  const e = env();
  let response = await call(e, "/api/admin/provision", {
    method: "POST",
    headers: { authorization: "Bearer admin-secret" },
    body: JSON.stringify({
      familyName: "测试家庭",
      username: "family001",
      password: "very-long-test-password",
      student: { displayName: "小王", graduationYear: 2027, className: "03班货", schoolLabel: "某高中" }
    })
  });
  assert.equal(response.status, 201);
  const provision = await response.json();

  response = await call(e, "/api/login", {
    method: "POST",
    body: JSON.stringify({ username: "family001", password: "very-long-test-password" })
  });
  assert.equal(response.status, 200);
  const cookie = cookieFrom(response);
  const login = await response.json();
  assert.ok(login.csrf);

  response = await call(e, "/api/me", { headers: { cookie } });
  assert.equal(response.status, 200);
  const me = await response.json();
  assert.equal(me.students[0].id, provision.studentId);

  response = await call(e, `/api/students/${provision.studentId}/exams`, {
    method: "POST",
    headers: { cookie, "x-score-csrf": login.csrf, origin: "https://score.example" },
    body: JSON.stringify({
      name: "9月联考",
      date: "2026-09-05",
      type: "joint",
      overall: { officialScore: 598, rankings: [{ scope: "school", label: "学校", rank: 128, participants: 1320 }] },
      subjects: { math: { fullScore: 150, rawScore: 126, finalScore: 126, scoreMode: "raw" } },
      notes: "这条家庭备洩不能泇漏"
    })
  });
  assert.equal(response.status, 201);
  const created = (await response.json()).exam;
  assert.equal(created.revision, 1);

  response = await call(e, `/api/students/${provision.studentId}/exams/${created.id}`, {
    method: "PUT",
    headers: { cookie, "x-score-csrf": login.csrf, origin: "https://score.example" },
    body: JSON.stringify({ ...created, expectedRevision: 99 })
  });
  assert.equal(response.status, 409);

  response = await call(e, `/api/students/${provision.studentId}/shares`, {
    method: "POST",
    headers: { cookie, "x-score-csrf": login.csrf, origin: "https://score.example" },
    body: JSON.stringify({ kind: "secret", mode: "snapshot", fields: { school: false, className: false, history: true } })
  });
  assert.equal(response.status, 201);
  const share = await response.json();
  assert.ok(share.token);

  response = await call(e, `/api/share/secret/${share.token}`);
  assert.equal(response.status, 200);
  const external = await response.json();
  assert.equal(external.data.student.schoolLabel, null);
  assert.equal(external.data.exams[0].overallScore, 598);
  assert.equal("notes" in external.data.exams[0], false);
});

test("mutations reject missing CSRF", async () => {
  const e = env();
  await call(e, "/api/admin/provision", {
    method: "POST",
    headers: { authorization: "Bearer admin-secret" },
    body: JSON.stringify({ username: "family002", password: "another-long-password", student: { displayName: "学生" } })
  });
  let response = await call(e, "/api/login", { method: "POST", body: JSON.stringify({ username: "family002", password: "another-long-password" }) });
  const cookie = cookieFrom(response);
  response = await call(e, "/api/me", { headers: { cookie } });
  const me = await response.json();
  response = await call(e, `/api/students/${me.students[0].id}/profile`, { method: "PATCH", headers: { cookie, origin: "https://score.example" }, body: JSON.stringify({ displayName: "不应成功" }) });
  assert.equal(response.status, 403);
});
