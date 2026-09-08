import { randomToken, sha256, hashPassword, verifyPassword, signSession, verifySessionToken } from "./lib/crypto.js";
import {
  assertPassword,
  assertUsername,
  normalizeExam,
  normalizePublicSlug,
  normalizeShareFields,
  normalizeUsername,
  publicProjection,
  safeText
} from "./lib/model.js";
import {
  clearSessionCookie,
  errorJson,
  json,
  parseCookies,
  readJson,
  sessionCookie,
  withSecurity
} from "./lib/http.js";
import { handleFamilyMemberPatch, handleFamilyMembers, handleFamilyStudentCreate } from "./family.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EXAMS = 80;

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function getJson(env, key) {
  return env.SCORE_KV.get(key, "json");
}

async function putJson(env, key, value) {
  await env.SCORE_KV.put(key, JSON.stringify(value));
}

async function usernameKey(username) {
  return `username:${await sha256(normalizeUsername(username))}`;
}

function requireRuntimeSecrets(env) {
  if (!env.SESSION_SECRET || !env.AUTH_PEPPER) throw new Error("服务端认证 Secret 尚未配置");
}

async function createSession(member, env) {
  requireRuntimeSecrets(env);
  const payload = {
    sub: member.id,
    fid: member.familyId,
    role: member.role,
    sv: member.sessionVersion,
    csrf: randomToken(18),
    exp: Date.now() + SESSION_TTL_MS
  };
  return { token: await signSession(payload, env.SESSION_SECRET), payload };
}

async function auth(request, env) {
  requireRuntimeSecrets(env);
  const token = parseCookies(request).score_session;
  const payload = await verifySessionToken(token, env.SESSION_SECRET);
  if (!payload) return null;
  const member = await getJson(env, `member:${payload.sub}`);
  if (!member || member.familyId !== payload.fid || member.sessionVersion !== payload.sv || member.disabledAt) return null;
  return { member, payload };
}

function requireCsrf(request, session) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const supplied = request.headers.get("x-score-csrf") || "";
  if (!session?.payload?.csrf || supplied !== session.payload.csrf) throw Object.assign(new Error("安全校验失败，请刷新后重试"), { status: 403, code: "csrf_failed" });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw Object.assign(new Error("跨站请求已拒绝"), { status: 403, code: "origin_mismatch" });
}

async function requireStudent(env, member, studentId, write = false) {
  const student = await getJson(env, `student:${studentId}`);
  if (!student || student.familyId !== member.familyId || (student.deletedAt && !write)) {
    throw Object.assign(new Error("找不到孩子资料"), { status: 404, code: "student_not_found" });
  }
  if (write && student.archivedAt && member.role !== "owner") {
    throw Object.assign(new Error("该孩子资料已归档，只有家庭管理员可以恢复"), { status: 403, code: "student_archived" });
  }
  if (write && member.role === "viewer") {
    throw Object.assign(new Error("当前账号只有查看权限"), { status: 403, code: "read_only" });
  }
  return student;
}

async function loadExamIndex(env, studentId) {
  const legacy = (await getJson(env, `exam-index:${studentId}`)) || { studentId, items: [], updatedAt: null };
  if (typeof env.SCORE_KV.list !== "function") return legacy;
  try {
    const listed = await env.SCORE_KV.list({ prefix: `exam-summary:${studentId}:`, limit: MAX_EXAMS });
    const summaries = await Promise.all((listed?.keys || []).map((key) => getJson(env, key.name)));
    const items = summaries.filter(Boolean);
    if (items.length) {
      items.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
      return { studentId, items: items.slice(0, MAX_EXAMS), updatedAt: now() };
    }
  } catch {
    // Local test KV and older bindings may not implement list; retain the legacy index.
  }
  return legacy;
}

async function saveExamIndex(env, studentId, items) {
  const normalized = items
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const bounded = normalized.slice(0, MAX_EXAMS);
  await Promise.all(bounded.map((item) => putJson(env, `exam-summary:${studentId}:${item.id}`, item)));
  await putJson(env, `exam-index:${studentId}`, { studentId, items: bounded, updatedAt: now() });
}

async function loadExams(env, studentId, { latestOnly = false } = {}) {
  const index = await loadExamIndex(env, studentId);
  const items = latestOnly ? index.items.slice(0, 1) : index.items.slice(0, MAX_EXAMS);
  const exams = await Promise.all(items.map((item) => getJson(env, `exam:${studentId}:${item.id}`)));
  return exams.filter((exam) => exam && !exam.deletedAt);
}

function examSummary(exam) {
  return { id: exam.id, name: exam.name, date: exam.date, type: exam.type, status: exam.status, revision: exam.revision, updatedAt: exam.updatedAt };
}

function assertRevision(body, existing) {
  const revision = Number(body.expectedRevision);
  if (!Number.isInteger(revision) || revision !== existing.revision) {
    throw Object.assign(new Error("这条成绩已在其他位置修改，请重新载入后再保存"), {
      status: 409,
      code: "revision_conflict",
      current: examSummary(existing)
    });
  }
}

function shareIndexKey(studentId) {
  return `share-index:${studentId}`;
}

async function getShareIndex(env, studentId) {
  return (await getJson(env, shareIndexKey(studentId))) || { studentId, items: [] };
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

async function buildProjection(env, student, grant) {
  if (grant.mode === "snapshot" && grant.snapshot) return grant.snapshot;
  const exams = await loadExams(env, student.id, { latestOnly: !grant.fields.history });
  return publicProjection(student, exams, grant.fields);
}

async function handleAdminProvision(request, env) {
  if (!env.ADMIN_BOOTSTRAP_SECRET) return errorJson("管理员建户入口未启用", 404, "not_found");
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader !== `Bearer ${env.ADMIN_BOOTSTRAP_SECRET}`) return errorJson("管理员凭据无效", 403, "forbidden");
  requireRuntimeSecrets(env);
  const body = await readJson(request);
  const username = assertUsername(body.username);
  const password = assertPassword(body.password);
  const uKey = await usernameKey(username);
  if (await env.SCORE_KV.get(uKey)) return errorJson("该账号已存在", 409, "username_exists");

  const familyId = id("fam");
  const memberId = id("mem");
  const studentId = id("stu");
  const iterations = Math.max(10000, Math.min(500000, Number(env.PASSWORD_ITERATIONS) || 20000));
  const passwordRecord = await hashPassword(password, env.AUTH_PEPPER, iterations);
  const createdAt = now();
  const member = {
    schemaVersion: 1,
    id: memberId,
    familyId,
    username,
    role: "owner",
    password: passwordRecord,
    recoveryCodeHash: null,
    recoveryRequired: true,
    sessionVersion: 1,
    createdAt,
    disabledAt: null
  };
  const family = {
    schemaVersion: 1,
    id: familyId,
    displayName: safeText(body.familyName, 80) || "我的家庭",
    memberIds: [memberId],
    studentIds: [studentId],
    createdAt
  };
  const student = {
    schemaVersion: 1,
    id: studentId,
    familyId,
    displayName: safeText(body.student?.displayName, 50) || "孩子",
    graduationYear: Number(body.student?.graduationYear) || null,
    grade: safeText(body.student?.grade, 30) || "高三",
    className: safeText(body.student?.className, 60),
    schoolLabel: safeText(body.student?.schoolLabel, 100),
    subjectTrack: safeText(body.student?.subjectTrack, 50) || "物化生",
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    archivedAt: null
  };

  await putJson(env, uKey, { memberId });
  await putJson(env, `member:${memberId}`, member);
  await putJson(env, `family:${familyId}`, family);
  await putJson(env, `student:${studentId}`, student);
  return json({ ok: true, familyId, memberId, studentId }, 201);
}

async function handleLogin(request, env) {
  requireRuntimeSecrets(env);
  const body = await readJson(request);
  const username = assertUsername(body.username);
  const password = assertPassword(body.password);
  const mapping = await getJson(env, await usernameKey(username));
  if (!mapping) return errorJson("账号或密码错误", 401, "invalid_credentials");
  const member = await getJson(env, `member:${mapping.memberId}`);
  if (!member || member.disabledAt || !(await verifyPassword(password, env.AUTH_PEPPER, member.password))) {
    return errorJson("账号或密码错误", 401, "invalid_credentials");
  }
  const session = await createSession(member, env);
  return json(
    { ok: true, csrf: session.payload.csrf, expiresAt: new Date(session.payload.exp).toISOString() },
    200,
    { "set-cookie": sessionCookie(session.token) }
  );
}

async function handleMe(request, env, session) {
  const family = await getJson(env, `family:${session.member.familyId}`);
  if (!family) return errorJson("家庭资料不存在", 404, "family_not_found");
  const students = (await Promise.all((family.studentIds || []).map((studentId) => getJson(env, `student:${studentId}`)))).filter((student) => student && !student.deletedAt);
  return json({
    member: { id: session.member.id, username: session.member.username, role: session.member.role },
    family: { id: family.id, displayName: family.displayName },
    students,
    csrf: session.payload.csrf,
    sessionExpiresAt: new Date(session.payload.exp).toISOString(),
    appVersion: env.APP_VERSION || "dev",
    schemaVersion: Number(env.SCHEMA_VERSION) || 1
    ,recoveryReady: Boolean(session.member.recoveryCodeHash)
  });
}

async function handleChangePassword(request, env, session) {
  requireCsrf(request, session);
  const body = await readJson(request);
  const currentPassword = assertPassword(body.currentPassword);
  const newPassword = assertPassword(body.newPassword);
  if (!(await verifyPassword(currentPassword, env.AUTH_PEPPER, session.member.password))) return errorJson("当前密码不正确", 403, "invalid_password");
  const iterations = Math.max(10000, Math.min(500000, Number(env.PASSWORD_ITERATIONS) || 20000));
  const updated = {
    ...session.member,
    password: await hashPassword(newPassword, env.AUTH_PEPPER, iterations),
    sessionVersion: session.member.sessionVersion + 1,
    passwordChangedAt: now()
  };
  await putJson(env, `member:${updated.id}`, updated);
  const newSession = await createSession(updated, env);
  return json({ ok: true, csrf: newSession.payload.csrf }, 200, { "set-cookie": sessionCookie(newSession.token) });
}

async function handleLogoutAll(request, env, session) {
  requireCsrf(request, session);
  const updated = { ...session.member, sessionVersion: session.member.sessionVersion + 1, sessionsRevokedAt: now() };
  await putJson(env, `member:${updated.id}`, updated);
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}

async function handleProfilePatch(request, env, session, studentId) {
  requireCsrf(request, session);
  const student = await requireStudent(env, session.member, studentId, true);
  if (student.archivedAt) return errorJson("该孩子资料已归档，恢复后才能创建分享", 409, "student_archived");
  const body = await readJson(request);
  const updated = {
    ...student,
    displayName: safeText(body.displayName, 50) || student.displayName,
    graduationYear: body.graduationYear == null ? student.graduationYear : Number(body.graduationYear) || null,
    grade: safeText(body.grade, 30) ?? student.grade,
    className: safeText(body.className, 60),
    schoolLabel: safeText(body.schoolLabel, 100),
    subjectTrack: safeText(body.subjectTrack, 50) ?? student.subjectTrack,
    updatedAt: now()
  };
  await putJson(env, `student:${studentId}`, updated);
  return json({ student: updated });
}

async function handleExamList(env, member, studentId) {
  await requireStudent(env, member, studentId, false);
  const exams = await loadExams(env, studentId);
  return json({ exams });
}

async function handleExamCreate(request, env, session, studentId) {
  requireCsrf(request, session);
  const student = await requireStudent(env, session.member, studentId, true);
  if (student.archivedAt) return errorJson("该孩子资料已归档，恢复后才能继续录入", 409, "student_archived");
  const body = await readJson(request);
  const input = { ...body, context: { schoolLabel: student.schoolLabel, classLabel: student.className, grade: student.grade, ...body.context } };
  const exam = normalizeExam(input);
  await putJson(env, `exam:${studentId}:${exam.id}`, exam);
  const index = await loadExamIndex(env, studentId);
  await saveExamIndex(env, studentId, [examSummary(exam), ...index.items.filter((item) => item.id !== exam.id)]);
  return json({ exam }, 201);
}

async function handleExamUpdate(request, env, session, studentId, examId) {
  requireCsrf(request, session);
  const student = await requireStudent(env, session.member, studentId, true);
  if (student.archivedAt) return errorJson("该孩子资料已归档，恢复后才能修改", 409, "student_archived");
  const existing = await getJson(env, `exam:${studentId}:${examId}`);
  if (!existing) return errorJson("考试记录不存在", 404, "exam_not_found");
  if (existing.deletedAt) return errorJson("这条考试已在回收站，请使用撤销删除", 410, "exam_in_trash");
  const body = await readJson(request);
  assertRevision(body, existing);
  const exam = normalizeExam({ ...body, id: examId }, existing);
  await putJson(env, `exam-history:${studentId}:${examId}:r${existing.revision}`, existing);
  await putJson(env, `exam:${studentId}:${examId}`, exam);
  const index = await loadExamIndex(env, studentId);
  await saveExamIndex(env, studentId, [examSummary(exam), ...index.items.filter((item) => item.id !== exam.id)]);
  return json({ exam });
}

async function handleExamDelete(request, env, session, studentId, examId) {
  requireCsrf(request, session);
  const student = await requireStudent(env, session.member, studentId, true);
  if (student.archivedAt) return errorJson("该孩子资料已归档，恢复后才能删除", 409, "student_archived");
  const existing = await getJson(env, `exam:${studentId}:${examId}`);
  if (!existing) return errorJson("考试记录不存在", 404, "exam_not_found");
  const body = await readJson(request);
  assertRevision(body, existing);
  const deletedAt = now();
  await putJson(env, `exam-history:${studentId}:${examId}:r${existing.revision}`, { ...existing, deletedAt });
  const deleted = { ...existing, deletedAt, deletedBy: session.member.id, updatedAt: deletedAt, revision: existing.revision + 1 };
  await putJson(env, `exam:${studentId}:${examId}`, deleted);
  const index = await loadExamIndex(env, studentId);
  await saveExamIndex(env, studentId, [examSummary(deleted), ...index.items.filter((item) => item.id !== examId)]);
  return json({ ok: true, undoUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
}

async function handleExamTrash(env, member, studentId) {
  await requireStudent(env, member, studentId, false);
  const index = await loadExamIndex(env, studentId);
  const exams = await Promise.all((index.items || []).map((item) => getJson(env, `exam:${studentId}:${item.id}`)));
  return json({ exams: exams.filter((exam) => exam?.deletedAt).sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt))) });
}

async function handleExamRestore(request, env, session, studentId, examId) {
  requireCsrf(request, session);
  await requireStudent(env, session.member, studentId, true);
  const existing = await getJson(env, `exam:${studentId}:${examId}`);
  if (!existing?.deletedAt) return errorJson("回收站中没有这条考试", 404, "exam_not_in_trash");
  const body = await readJson(request);
  assertRevision(body, existing);
  const restored = { ...existing, deletedAt: null, deletedBy: null, updatedAt: now(), revision: existing.revision + 1 };
  await putJson(env, `exam:${studentId}:${examId}`, restored);
  const index = await loadExamIndex(env, studentId);
  await saveExamIndex(env, studentId, [examSummary(restored), ...index.items.filter((item) => item.id !== examId)]);
  return json({ exam: restored });
}

async function handleStudentLifecycle(request, env, session, studentId) {
  requireCsrf(request, session);
  if (session.member.role !== "owner") throw Object.assign(new Error("只有家庭管理员可以归档资料"), { status: 403, code: "owner_required" });
  const student = await requireStudent(env, session.member, studentId, true);
  const body = await readJson(request);
  const archived = Boolean(body.archived);
  const updated = { ...student, archivedAt: archived ? (student.archivedAt || now()) : null, updatedAt: now() };
  await putJson(env, `student:${studentId}`, updated);
  if (archived) {
    const shares = await getShareIndex(env, studentId);
    await Promise.all((shares.items || []).map(async (item) => {
      const key = `share:${item.kind}:${item.kind === "secret" ? item.locator : item.locator}`;
      await env.SCORE_KV.delete(key);
    }));
    await putJson(env, shareIndexKey(studentId), { studentId, items: [] });
  }
  return json({ student: updated, archived });
}

async function handleExport(env, member, studentId) {
  const student = await requireStudent(env, member, studentId, false);
  const family = await getJson(env, `family:${member.familyId}`);
  const exams = await loadExams(env, studentId);
  return json({ exportedAt: now(), schemaVersion: 1, family: { id: family?.id, displayName: family?.displayName }, student, exams });
}

async function handleFamilyExport(env, member) {
  if (member.role !== "owner") throw Object.assign(new Error("只有家庭管理员可以导出全家庭数据"), { status: 403, code: "owner_required" });
  const family = await getJson(env, `family:${member.familyId}`);
  if (!family) return errorJson("家庭资料不存在", 404, "family_not_found");
  const students = (await Promise.all((family.studentIds || []).map((id) => getJson(env, `student:${id}`)))).filter(Boolean);
  const exams = [];
  const shares = [];
  for (const student of students) exams.push(...await loadExams(env, student.id), ...await (async () => {
    const index = await loadExamIndex(env, student.id);
    const all = await Promise.all((index.items || []).map((item) => getJson(env, `exam:${student.id}:${item.id}`)));
    return all.filter((exam) => exam?.deletedAt);
  })());
  for (const student of students) shares.push(...((await getShareIndex(env, student.id)).items || []).map((share) => ({ ...share, studentId: student.id })));
  return json({ exportedAt: now(), schemaVersion: 1, family: { id: family.id, displayName: family.displayName }, students, exams, shares, members: (await Promise.all((family.memberIds || []).map((id) => getJson(env, `member:${id}`)))).filter(Boolean).map((m) => ({ id: m.id, username: m.username, role: m.role, createdAt: m.createdAt, disabledAt: m.disabledAt || null })) });
}

async function handleShareList(env, member, studentId) {
  await requireStudent(env, member, studentId, false);
  const index = await getShareIndex(env, studentId);
  return json({ shares: index.items || [] });
}

async function handleShareCreate(request, env, session, studentId) {
  requireCsrf(request, session);
  const student = await requireStudent(env, session.member, studentId, true);
  const body = await readJson(request);
  const kind = body.kind === "public" ? "public" : "secret";
  const mode = body.mode === "snapshot" ? "snapshot" : "live";
  const fields = normalizeShareFields(body.fields);
  const expiresAt = validExpiry(body.expiresAt);
  const createdAt = now();
  const base = { schemaVersion: 1, studentId, kind, mode, fields, expiresAt, createdAt };
  let lookupKey;
  let locator;
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
  if (mode === "snapshot") {
    const exams = await loadExams(env, studentId, { latestOnly: !fields.history });
    grant.snapshot = publicProjection(student, exams, fields);
  }
  await putJson(env, lookupKey, grant);
  const index = await getShareIndex(env, studentId);
  const item = { kind, mode, fields, expiresAt, createdAt, locator };
  await putJson(env, shareIndexKey(studentId), { studentId, items: [item, ...(index.items || []).filter((x) => !(x.kind === kind && x.locator === locator))] });
  return json({ share: item, token: rawToken }, 201);
}

async function handleShareRevoke(request, env, session, studentId) {
  requireCsrf(request, session);
  await requireStudent(env, session.member, studentId, true);
  const body = await readJson(request);
  const kind = body.kind === "public" ? "public" : "secret";
  const locator = String(body.locator || "");
  if (!locator) throw new Error("缺少分享标识");
  await env.SCORE_KV.delete(`share:${kind}:${locator}`);
  const index = await getShareIndex(env, studentId);
  await putJson(env, shareIndexKey(studentId), { studentId, items: (index.items || []).filter((x) => !(x.kind === kind && x.locator === locator)) });
  return json({ ok: true });
}

async function handleExternalShare(env, kind, locator) {
  const resolved = kind === "secret" ? await sha256(locator) : locator;
  const grant = await getJson(env, `share:${kind}:${resolved}`);
  if (!grant || isExpired(grant)) return errorJson("分享链接不存在或已失效", 404, "share_not_found");
  const student = await getJson(env, `student:${grant.studentId}`);
  if (!student || student.deletedAt) return errorJson("分享链接不存在或已失效", 404, "share_not_found");
  const data = await buildProjection(env, student, grant);
  return json({ share: { kind, mode: grant.mode, expiresAt: grant.expiresAt }, data });
}

async function routeApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/health") {
    return json({ ok: true, appVersion: env.APP_VERSION || "dev", buildSha: env.BUILD_SHA || null, schemaVersion: Number(env.SCHEMA_VERSION) || 1, storage: "workers-kv" });
  }
  if (request.method === "POST" && path === "/api/admin/provision") return handleAdminProvision(request, env);
  if (request.method === "POST" && path === "/api/login") return handleLogin(request, env);
  if (request.method === "POST" && path === "/api/logout") return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });

  const secretMatch = path.match(/^\/api\/share\/secret\/(.+)$/);
  if (request.method === "GET" && secretMatch) return handleExternalShare(env, "secret", decodeURIComponent(secretMatch[1]));
  const publicMatch = path.match(/^\/api\/share\/public\/([a-z0-9-]+)$/);
  if (request.method === "GET" && publicMatch) return handleExternalShare(env, "public", publicMatch[1]);

  const session = await auth(request, env);
  if (!session) return errorJson("请先登录", 401, "unauthorized");

  if (request.method === "GET" && path === "/api/me") return handleMe(request, env, session);
  if (request.method === "POST" && path === "/api/me/password") return handleChangePassword(request, env, session);
  if (request.method === "POST" && path === "/api/me/logout-all") return handleLogoutAll(request, env, session);
  if (request.method === "GET" && path === "/api/family/export") return handleFamilyExport(env, session.member);

  if ((request.method === "GET" || request.method === "POST") && path === "/api/family/members") {
    const response = await handleFamilyMembers(request, env, session);
    if (response) return response;
  }
  const familyMemberMatch = path.match(/^\/api\/family\/members\/([^/]+)$/);
  if (request.method === "PATCH" && familyMemberMatch) return handleFamilyMemberPatch(request, env, session, familyMemberMatch[1]);
  if (request.method === "POST" && path === "/api/family/students") return handleFamilyStudentCreate(request, env, session);

  const profileMatch = path.match(/^\/api\/students\/([^/]+)\/profile$/);
  if (request.method === "PATCH" && profileMatch) return handleProfilePatch(request, env, session, profileMatch[1]);
  const lifecycleMatch = path.match(/^\/api\/students\/([^/]+)\/lifecycle$/);
  if (request.method === "PATCH" && lifecycleMatch) return handleStudentLifecycle(request, env, session, lifecycleMatch[1]);

  const examsMatch = path.match(/^\/api\/students\/([^/]+)\/exams$/);
  if (examsMatch && request.method === "GET") return handleExamList(env, session.member, examsMatch[1]);
  if (examsMatch && request.method === "POST") return handleExamCreate(request, env, session, examsMatch[1]);
  const trashMatch = path.match(/^\/api\/students\/([^/]+)\/exams\/trash$/);
  if (trashMatch && request.method === "GET") return handleExamTrash(env, session.member, trashMatch[1]);
  const restoreMatch = path.match(/^\/api\/students\/([^/]+)\/exams\/([^/]+)\/restore$/);
  if (restoreMatch && request.method === "POST") return handleExamRestore(request, env, session, restoreMatch[1], restoreMatch[2]);

  const examMatch = path.match(/^\/api\/students\/([^/]+)\/exams\/([^/]+)$/);
  if (examMatch && request.method === "PUT") return handleExamUpdate(request, env, session, examMatch[1], examMatch[2]);
  if (examMatch && request.method === "DELETE") return handleExamDelete(request, env, session, examMatch[1], examMatch[2]);

  const exportMatch = path.match(/^\/api\/students\/([^/]+)\/export$/);
  if (request.method === "GET" && exportMatch) return handleExport(env, session.member, exportMatch[1]);

  const sharesMatch = path.match(/^\/api\/students\/([^/]+)\/shares$/);
  if (sharesMatch && request.method === "GET") return handleShareList(env, session.member, sharesMatch[1]);
  if (sharesMatch && request.method === "POST") return handleShareCreate(request, env, session, sharesMatch[1]);

  const revokeMatch = path.match(/^\/api\/students\/([^/]+)\/shares\/revoke$/);
  if (request.method === "POST" && revokeMatch) return handleShareRevoke(request, env, session, revokeMatch[1]);

  return errorJson("接口不存在", 404, "not_found");
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return withSecurity(await routeApi(request, env), { noStore: true });
      const asset = await env.ASSETS.fetch(request);
      const isSensitiveShell = url.pathname === "/" || url.pathname.startsWith("/app") || url.pathname.startsWith("/share/") || url.pathname.startsWith("/p/");
      return withSecurity(asset, { noStore: isSensitiveShell });
    } catch (error) {
      const status = error?.status || 400;
      const response = errorJson(error?.message || "请求处理失败", status, error?.code || "request_failed", error?.field || null);
      if (error?.current) {
        const payload = await response.json();
        return withSecurity(json({ ...payload, current: error.current }, status), { noStore: true });
      }
      return withSecurity(response, { noStore: true });
    }
  }
};
