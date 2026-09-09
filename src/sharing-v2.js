import { randomToken, sha256 } from "./lib/crypto.js";
import { normalizePublicSlug, normalizeShareFields, publicProjection } from "./lib/model.js";
import { errorJson, json, readJson } from "./lib/http.js";

const MAX_EXAMS = 80;

async function getJson(env, key) {
  return env.SCORE_KV.get(key, "json");
}

async function putJson(env, key, value) {
  await env.SCORE_KV.put(key, JSON.stringify(value));
}

function requireCsrf(request, session) {
  const supplied = request.headers.get("x-score-csrf") || "";
  if (!session?.payload?.csrf || supplied !== session.payload.csrf) {
    throw Object.assign(new Error("安全校验失败，请刷新后重试"), { status: 403, code: "csrf_failed" });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw Object.assign(new Error("跨站请求已拒绝"), { status: 403, code: "origin_mismatch" });
  }
}

async function requireStudent(env, member, studentId, write = false) {
  const student = await getJson(env, `student:${studentId}`);
  if (!student || student.deletedAt || student.familyId !== member.familyId) {
    throw Object.assign(new Error("找不到孩子资料"), { status: 404, code: "student_not_found" });
  }
  if (write && member.role === "viewer") {
    throw Object.assign(new Error("当前账号只有查看权限"), { status: 403, code: "read_only" });
  }
  return student;
}

function validExpiry(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new Error("分享有效期无效");
  return date.toISOString();
}

function isExpired(grant) {
  return Boolean(grant.expiresAt && Date.now() >= new Date(grant.expiresAt).getTime());
}

async function loadExams(env, studentId) {
  let index = (await getJson(env, `exam-index:${studentId}`)) || { items: [] };
  if (typeof env.SCORE_KV.list === "function") {
    try {
      const listed = await env.SCORE_KV.list({ prefix: `exam-summary:${studentId}:`, limit: MAX_EXAMS });
      const summaries = await Promise.all((listed?.keys || []).map((key) => getJson(env, key.name)));
      if (summaries.some(Boolean)) index = { items: summaries.filter(Boolean) };
    } catch {}
  }
  index.items = (index.items || []).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const exams = await Promise.all((index.items || []).slice(0, MAX_EXAMS).map((item) => getJson(env, `exam:${studentId}:${item.id}`)));
  return exams.filter((exam) => exam && !exam.deletedAt);
}

async function selectExams(env, studentId, scope, examId = null) {
  if (scope === "single") {
    if (examId) {
      const exam = await getJson(env, `exam:${studentId}:${examId}`);
      return exam && !exam.deletedAt ? [exam] : [];
    }
    const all = await loadExams(env, studentId);
    return all[0] ? [all[0]] : [];
  }
  return loadExams(env, studentId);
}

function shareIndexKey(studentId) {
  return `share-index:${studentId}`;
}

async function shareIndex(env, studentId) {
  return (await getJson(env, shareIndexKey(studentId))) || { studentId, items: [] };
}

async function handleCreate(request, env, session, studentId) {
  requireCsrf(request, session);
  const student = await requireStudent(env, session.member, studentId, true);
  if (student.archivedAt) return errorJson("该孩子资料已归档，恢复后才能创建分享", 409, "student_archived");
  const body = await readJson(request);
  const kind = body.kind === "public" ? "public" : "secret";
  const mode = body.mode === "snapshot" ? "snapshot" : "live";
  const fields = normalizeShareFields(body.fields);
  const requestedScope = body.scope === "single" || body.scope === "trajectory" ? body.scope : null;
  let scope = requestedScope;
  if (!scope) scope = "single";
  fields.history = scope === "trajectory";
  const expiresAt = validExpiry(body.expiresAt);
  const exams = await selectExams(env, studentId, scope, body.examId || null);
  if (!exams.length) {
    return errorJson(body.examId ? "指定的考试不存在" : "还没有可分享的考试记录", 400, body.examId ? "exam_not_found" : "no_exam_to_share");
  }
  if (scope === "trajectory" && mode === "live" && exams.length === 1 && body.futureExamsAcknowledged !== true) {
    return errorJson("请先确认以后新增的考试会自动进入这个分享链接", 400, "future_exams_acknowledgement_required");
  }

  const selectedExam = scope === "single" ? exams[0] : null;
  const createdAt = new Date().toISOString();
  const base = {
    schemaVersion: 2,
    studentId,
    kind,
    mode,
    scope,
    examId: selectedExam?.id || null,
    examName: selectedExam?.name || null,
    fields,
    expiresAt,
    createdAt
  };

  let locator;
  let lookupKey;
  let rawToken = null;
  if (kind === "secret") {
    rawToken = randomToken(32);
    locator = await sha256(rawToken);
    lookupKey = `share:secret:${locator}`;
  } else {
    locator = normalizePublicSlug(body.slug);
    lookupKey = `share:public:${locator}`;
    if (await env.SCORE_KV.get(lookupKey)) return errorJson("这个公开地址已被占用", 409, "slug_exists");
  }

  const grant = { ...base, locator };
  if (mode === "snapshot") grant.snapshot = publicProjection(student, exams, fields);
  await putJson(env, lookupKey, grant);

  const index = await shareIndex(env, studentId);
  const item = { kind, mode, scope, examId: base.examId, examName: base.examName, fields, expiresAt, createdAt, locator };
  await putJson(env, shareIndexKey(studentId), {
    studentId,
    items: [item, ...(index.items || []).filter((x) => !(x.kind === kind && x.locator === locator))]
  });
  return json({ share: item, token: rawToken }, 201);
}

async function handleExternal(env, kind, rawLocator) {
  const locator = kind === "secret" ? await sha256(rawLocator) : rawLocator;
  const grant = await getJson(env, `share:${kind}:${locator}`);
  if (!grant || !grant.scope) return null;
  if (isExpired(grant)) return errorJson("分享链接不存在或已失效", 404, "share_not_found");
  const student = await getJson(env, `student:${grant.studentId}`);
  if (!student || student.deletedAt) return errorJson("分享链接不存在或已失效", 404, "share_not_found");

  let data = grant.mode === "snapshot" && grant.snapshot ? grant.snapshot : null;
  if (!data) {
    const exams = await selectExams(env, student.id, grant.scope, grant.examId || null);
    if (grant.scope === "single" && !exams.length) return errorJson("这次考试已不存在，分享链接无法继续展示", 404, "shared_exam_not_found");
    data = publicProjection(student, exams, grant.fields);
  }
  return json({
    share: {
      kind,
      mode: grant.mode,
      scope: grant.scope,
      examId: grant.examId || null,
      examName: grant.examName || null,
      expiresAt: grant.expiresAt,
      fields: grant.fields,
      examCount: data.exams?.length || 0,
      includesFutureExams: grant.scope === "trajectory" && grant.mode === "live"
    },
    data
  });
}

export async function routePrivateSharingV2(request, env, session) {
  const path = new URL(request.url).pathname;
  const match = path.match(/^\/api\/students\/([^/]+)\/shares$/);
  if (request.method === "POST" && match) return handleCreate(request, env, session, match[1]);
  return null;
}

export async function routePublicSharingV2(request, env) {
  if (request.method !== "GET") return null;
  const path = new URL(request.url).pathname;
  const secret = path.match(/^\/api\/share\/secret\/(.+)$/);
  if (secret) return handleExternal(env, "secret", decodeURIComponent(secret[1]));
  const publicMatch = path.match(/^\/api\/share\/public\/([a-z0-9-]+)$/);
  if (publicMatch) return handleExternal(env, "public", publicMatch[1]);
  return null;
}
