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

async function provisionAndLogin(e, username, password = "very-long-test-password") {
  let response = await call(e, "/api/admin/provision", {
    method: "POST",
    headers: { authorization: "Bearer admin-secret" },
    body: JSON.stringify({ username, password, student: { displayName: "学生", graduationYear: 2027, className: "03班", schoolLabel: "某高中" } })
  });
  assert.equal(response.status, 201);
  const provision = await response.json();
  response = await call(e, "/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
  assert.equal(response.status, 200);
  const cookie = cookieFrom(response);
  const login = await response.json();
  return { provision, cookie, csrf: login.csrf };
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

test("three-character public share carries multiple exams and rank-only data", async () => {
  const e = env();
  const { provision, cookie, csrf } = await provisionAndLogin(e, "family003");
  for (const exam of [
    { name: "9月月考", date: "2026-09-01", score: 570, rank: 182, math: 112 },
    { name: "10月联考", date: "2026-10-01", score: 586, rank: 151, math: 121 }
  ]) {
    const response = await call(e, `/api/students/${provision.studentId}/exams`, {
      method: "POST",
      headers: { cookie, "x-score-csrf": csrf, origin: "https://score.example" },
      body: JSON.stringify({
        name: exam.name,
        date: exam.date,
        type: "monthly",
        overall: { officialScore: exam.score, rankings: [{ scope: "school", label: "学校", rank: exam.rank }] },
        subjects: { math: { fullScore: 150, rawScore: exam.math, finalScore: exam.math, scoreMode: "raw" } }
      })
    });
    assert.equal(response.status, 201);
  }

  let response = await call(e, `/api/students/${provision.studentId}/shares`, {
    method: "POST",
    headers: { cookie, "x-score-csrf": csrf, origin: "https://score.example" },
    body: JSON.stringify({ kind: "public", slug: "ABC", mode: "live", scope: "trajectory", fields: { history: true, overallRank: true, overallScore: true, subjectScores: true } })
  });
  assert.equal(response.status, 201);
  const createdShare = await response.json();
  assert.equal(createdShare.share.locator, "abc");

  response = await call(e, "/api/share/public/abc");
  assert.equal(response.status, 200);
  const external = await response.json();
  assert.equal(external.data.exams.length, 2);
  assert.equal(external.data.exams[0].name, "10月联考");
  assert.equal(external.data.exams[0].overallRankings[0].rank, 151);
  assert.equal(external.data.exams[0].overallRankings[0].participants, null);
  assert.equal(external.data.exams[1].subjects.math.finalScore, 112);
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

test("v0.11.0 runtime share contract honors selected exam, preview, trajectory, snapshot and revoke", async () => {
  const e = env();
  const { provision, cookie, csrf } = await provisionAndLogin(e, "family004");

  async function createExam(name, date, score) {
    const response = await call(e, `/api/students/${provision.studentId}/exams`, {
      method: "POST",
      headers: { cookie, "x-score-csrf": csrf, origin: "https://score.example" },
      body: JSON.stringify({
        name,
        date,
        type: "monthly",
        overall: { officialScore: score, rankings: [{ scope: "school", label: "学校", rank: 100 }] },
        subjects: { math: { fullScore: 150, rawScore: score - 450, finalScore: score - 450, scoreMode: "raw" } }
      })
    });
    assert.equal(response.status, 201);
    return (await response.json()).exam;
  }

  const examA = await createExam("9月月考", "2026-09-01", 570);
  await createExam("9月第二次月考", "2026-09-10", 580);

  let response = await call(e, `/api/students/${provision.studentId}/shares`, {
    method: "POST",
    headers: { cookie, "x-score-csrf": csrf, origin: "https://score.example" },
    body: JSON.stringify({
      kind: "secret",
      mode: "live",
      scope: "single",
      examId: examA.id,
      fields: { overallScore: true, overallRank: true }
    })
  });
  assert.equal(response.status, 201);
  const single = await response.json();
  assert.equal(single.share.scope, "single");
  assert.equal(single.share.examId, examA.id);

  response = await call(e, `/api/share/secret/${encodeURIComponent(single.token)}`);
  assert.equal(response.status, 200);
  let external = await response.json();
  assert.equal(external.data.exams.length, 1);
  assert.equal(external.data.exams[0].id, examA.id);

  response = await call(e, `/api/students/${provision.studentId}/shares/secret/${encodeURIComponent(single.share.locator)}/preview`, { headers: { cookie } });
  assert.equal(response.status, 200);
  const preview = await response.json();
  assert.equal(preview.share.scope, "single");
  assert.equal(preview.data.exams[0].id, examA.id);

  response = await call(e, `/api/students/${provision.studentId}/shares`, {
    method: "POST",
    headers: { cookie, "x-score-csrf": csrf, origin: "https://score.example" },
    body: JSON.stringify({
      kind: "public",
      slug: "v110-live",
      mode: "live",
      scope: "trajectory",
      fields: { overallScore: true, overallRank: true, subjectScores: true }
    })
  });
  assert.equal(response.status, 201);
  const live = await response.json();

  const examC = await createExam("9月第三次月考", "2026-09-20", 590);
  response = await call(e, "/api/share/public/v110-live");
  assert.equal(response.status, 200);
  external = await response.json();
  assert.equal(external.data.exams[0].id, examC.id);
  assert.equal(external.data.exams.length, 3);

  response = await call(e, `/api/students/${provision.studentId}/shares`, {
    method: "POST",
    headers: { cookie, "x-score-csrf": csrf, origin: "https://score.example" },
    body: JSON.stringify({
      kind: "public",
      slug: "v110-snapshot",
      mode: "snapshot",
      scope: "trajectory",
      fields: { overallScore: true }
    })
  });
  assert.equal(response.status, 201);
  const snapshot = await response.json();
  await createExam("9月第四次月考", "2026-09-25", 600);

  response = await call(e, "/api/share/public/v110-snapshot");
  assert.equal(response.status, 200);
  external = await response.json();
  assert.equal(external.data.exams.length, 3);
  assert.equal(external.data.exams[0].id, examC.id);

  response = await call(e, `/api/students/${provision.studentId}/shares/revoke`, {
    method: "POST",
    headers: { cookie, "x-score-csrf": csrf, origin: "https://score.example" },
    body: JSON.stringify({ kind: "public", locator: live.share.locator })
  });
  assert.equal(response.status, 200);

  response = await call(e, "/api/share/public/v110-live");
  assert.equal(response.status, 404);
  assert.ok(snapshot.share.locator);
});

test("v0.11.0 legacy share grants without scope remain readable", async () => {
  const e = env();
  const { provision } = await provisionAndLogin(e, "family005");
  const exam = {
    id: "legacy-exam",
    name: "历史月考",
    date: "2026-08-01",
    type: "monthly",
    status: "normal",
    overall: { officialScore: 550, rankings: [] },
    subjects: { chinese: { fullScore: 150, rawScore: 120, finalScore: null, scoreMode: "raw", rankings: [] } }
  };
  await e.SCORE_KV.put(`student:${provision.studentId}`, JSON.stringify({
    ...(await e.SCORE_KV.get(`student:${provision.studentId}`, "json")),
    archivedAt: null
  }));
  await e.SCORE_KV.put(`exam:${provision.studentId}:${exam.id}`, JSON.stringify(exam));
  await e.SCORE_KV.put(`exam-summary:${provision.studentId}:${exam.id}`, JSON.stringify({ id: exam.id, name: exam.name, date: exam.date, type: exam.type, revision: 1, updatedAt: "2026-08-01T00:00:00.000Z" }));
  const locator = "legacy-v1";
  await e.SCORE_KV.put(`share:public:${locator}`, JSON.stringify({
    schemaVersion: 1,
    studentId: provision.studentId,
    kind: "public",
    mode: "live",
    fields: { displayName: true, overallScore: true, history: false },
    expiresAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    locator
  }));
  await e.SCORE_KV.put(`share-index:${provision.studentId}`, JSON.stringify({
    studentId: provision.studentId,
    items: [{ kind: "public", mode: "live", fields: { displayName: true, overallScore: true, history: false }, expiresAt: null, createdAt: "2026-08-01T00:00:00.000Z", locator }]
  }));

  const response = await call(e, "/api/share/public/legacy-v1");
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.share.scope, "single");
  assert.equal(payload.data.exams.length, 1);
  assert.equal(payload.data.exams[0].id, exam.id);
});

test("v0.11.0 trajectory live creation with one exam still requires acknowledgement", async () => {
  const e = env();
  const { provision, cookie, csrf } = await provisionAndLogin(e, "family006");

  await call(e, `/api/students/${provision.studentId}/exams`, {
    method: "POST",
    headers: { cookie, "x-score-csrf": csrf, origin: "https://score.example" },
    body: JSON.stringify({
      name: "单次月考",
      date: "2026-09-11",
      type: "monthly",
      overall: { officialScore: 560 },
      subjects: { math: { fullScore: 150, rawScore: 110, finalScore: 110, scoreMode: "raw" } }
    })
  });

  const rejected = await call(e, `/api/students/${provision.studentId}/shares`, {
    method: "POST",
    headers: { cookie, "x-score-csrf": csrf, origin: "https://score.example" },
    body: JSON.stringify({
      kind: "public",
      slug: "v110-ack",
      mode: "live",
      scope: "trajectory",
      fields: { overallScore: true }
    })
  });
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.json()).error, "future_exams_acknowledgement_required");
});
