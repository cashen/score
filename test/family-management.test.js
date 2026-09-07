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

async function login(e, username, password) {
  const response = await call(e, "/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
  const payload = await response.json();
  return { response, cookie: cookieFrom(response), csrf: payload.csrf };
}

async function ownerSession(e) {
  const response = await call(e, "/api/admin/provision", {
    method: "POST",
    headers: { authorization: "Bearer admin-secret" },
    body: JSON.stringify({ familyName: "测试家庭", username: "owner001", password: "owner-long-password", student: { displayName: "孩子一" } })
  });
  assert.equal(response.status, 201);
  const provision = await response.json();
  const auth = await login(e, "owner001", "owner-long-password");
  assert.equal(auth.response.status, 200);
  return { ...auth, provision };
}

function mutationHeaders(session) {
  return { cookie: session.cookie, "x-score-csrf": session.csrf, origin: "https://score.example" };
}

test("owner creates safe editor member and editor can add another child", async () => {
  const e = env();
  const owner = await ownerSession(e);

  let response = await call(e, "/api/family/members", {
    method: "POST",
    headers: mutationHeaders(owner),
    body: JSON.stringify({ username: "parent02", password: "second-parent-password", role: "editor" })
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.member.username, "parent02");
  assert.equal(created.member.role, "editor");
  assert.equal("password" in created.member, false);

  response = await call(e, "/api/family/members", { headers: { cookie: owner.cookie } });
  assert.equal(response.status, 200);
  const list = await response.json();
  assert.equal(list.members.length, 2);
  assert.equal(list.members.some((member) => "password" in member), false);

  const editor = await login(e, "parent02", "second-parent-password");
  assert.equal(editor.response.status, 200);
  response = await call(e, "/api/family/students", {
    method: "POST",
    headers: mutationHeaders(editor),
    body: JSON.stringify({ displayName: "孩子二", graduationYear: 2028, schoolLabel: "另一所高中", subjectTrack: "物化生" })
  });
  assert.equal(response.status, 201);
  const added = await response.json();
  assert.equal(added.student.displayName, "孩子二");

  response = await call(e, "/api/me", { headers: { cookie: editor.cookie } });
  assert.equal(response.status, 200);
  const me = await response.json();
  assert.equal(me.students.length, 2);
  assert.deepEqual(me.students.map((student) => student.displayName).sort(), ["孩子一", "孩子二"]);
});

test("viewer cannot create members or children", async () => {
  const e = env();
  const owner = await ownerSession(e);
  let response = await call(e, "/api/family/members", {
    method: "POST",
    headers: mutationHeaders(owner),
    body: JSON.stringify({ username: "viewer01", password: "viewer-long-password", role: "viewer" })
  });
  assert.equal(response.status, 201);

  const viewer = await login(e, "viewer01", "viewer-long-password");
  assert.equal(viewer.response.status, 200);

  response = await call(e, "/api/family/students", {
    method: "POST",
    headers: mutationHeaders(viewer),
    body: JSON.stringify({ displayName: "不应创建" })
  });
  assert.equal(response.status, 403);

  response = await call(e, "/api/family/members", {
    method: "POST",
    headers: mutationHeaders(viewer),
    body: JSON.stringify({ username: "nope001", password: "not-allowed-password", role: "editor" })
  });
  assert.equal(response.status, 403);
});

test("owner role change invalidates an existing member session", async () => {
  const e = env();
  const owner = await ownerSession(e);
  let response = await call(e, "/api/family/members", {
    method: "POST",
    headers: mutationHeaders(owner),
    body: JSON.stringify({ username: "parent03", password: "third-parent-password", role: "editor" })
  });
  const created = await response.json();
  const editor = await login(e, "parent03", "third-parent-password");
  assert.equal(editor.response.status, 200);

  response = await call(e, `/api/family/members/${created.member.id}`, {
    method: "PATCH",
    headers: mutationHeaders(owner),
    body: JSON.stringify({ role: "viewer" })
  });
  assert.equal(response.status, 200);

  response = await call(e, "/api/me", { headers: { cookie: editor.cookie } });
  assert.equal(response.status, 401);

  const relogin = await login(e, "parent03", "third-parent-password");
  assert.equal(relogin.response.status, 200);
  response = await call(e, "/api/me", { headers: { cookie: relogin.cookie } });
  const me = await response.json();
  assert.equal(me.member.role, "viewer");
});

test("owner can disable and re-enable a member without exposing or replacing password", async () => {
  const e = env();
  const owner = await ownerSession(e);
  let response = await call(e, "/api/family/members", {
    method: "POST",
    headers: mutationHeaders(owner),
    body: JSON.stringify({ username: "parent04", password: "fourth-parent-password", role: "editor" })
  });
  const created = await response.json();
  const firstLogin = await login(e, "parent04", "fourth-parent-password");
  assert.equal(firstLogin.response.status, 200);

  response = await call(e, `/api/family/members/${created.member.id}`, {
    method: "PATCH",
    headers: mutationHeaders(owner),
    body: JSON.stringify({ enabled: false })
  });
  assert.equal(response.status, 200);
  const disabled = await response.json();
  assert.ok(disabled.member.disabledAt);
  assert.equal("password" in disabled.member, false);

  response = await call(e, "/api/me", { headers: { cookie: firstLogin.cookie } });
  assert.equal(response.status, 401);
  let disabledLogin = await login(e, "parent04", "fourth-parent-password");
  assert.equal(disabledLogin.response.status, 401);

  response = await call(e, `/api/family/members/${created.member.id}`, {
    method: "PATCH",
    headers: mutationHeaders(owner),
    body: JSON.stringify({ enabled: true })
  });
  assert.equal(response.status, 200);
  const enabled = await response.json();
  assert.equal(enabled.member.disabledAt, null);

  disabledLogin = await login(e, "parent04", "fourth-parent-password");
  assert.equal(disabledLogin.response.status, 200);
});
