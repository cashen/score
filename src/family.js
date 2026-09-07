import { sha256, hashPassword } from "./lib/crypto.js";
import { assertPassword, assertUsername, normalizeUsername, safeText } from "./lib/model.js";
import { errorJson, json, readJson } from "./lib/http.js";

const MAX_FAMILY_MEMBERS = 12;
const MAX_FAMILY_STUDENTS = 12;

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

function requireOwner(session) {
  if (session.member.role !== "owner") {
    throw Object.assign(new Error("只有家庭管理员可以管理登录成员"), { status: 403, code: "owner_required" });
  }
}

function requireEditor(session) {
  if (session.member.role === "viewer") {
    throw Object.assign(new Error("当前账号只有查看权限"), { status: 403, code: "read_only" });
  }
}

function managedRole(value) {
  if (value === "editor" || value === "viewer") return value;
  throw Object.assign(new Error("成员权限只能选择“可编辑”或“仅查看”"), { status: 400, code: "invalid_role" });
}

function memberSummary(member, currentMemberId) {
  return {
    id: member.id,
    username: member.username,
    role: member.role,
    createdAt: member.createdAt,
    disabledAt: member.disabledAt || null,
    isCurrent: member.id === currentMemberId
  };
}

async function loadFamily(env, familyId) {
  const family = await getJson(env, `family:${familyId}`);
  if (!family) throw Object.assign(new Error("家庭资料不存在"), { status: 404, code: "family_not_found" });
  return family;
}

function graduationYear(value) {
  if (value === "" || value == null) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw Object.assign(new Error("毕业年份无效"), { status: 400, code: "invalid_graduation_year" });
  }
  return year;
}

function newStudent(familyId, input = {}) {
  const createdAt = now();
  return {
    schemaVersion: 1,
    id: id("stu"),
    familyId,
    displayName: safeText(input.displayName, 50) || "孩子",
    graduationYear: graduationYear(input.graduationYear),
    grade: safeText(input.grade, 30) || "高三",
    className: safeText(input.className, 60),
    schoolLabel: safeText(input.schoolLabel, 100),
    subjectTrack: safeText(input.subjectTrack, 50) || "物化生",
    createdAt,
    updatedAt: createdAt,
    deletedAt: null
  };
}

export async function handleFamilyMembers(request, env, session) {
  const family = await loadFamily(env, session.member.familyId);

  if (request.method === "GET") {
    const members = (await Promise.all((family.memberIds || []).map((memberId) => getJson(env, `member:${memberId}`))))
      .filter((member) => member && member.familyId === family.id)
      .map((member) => memberSummary(member, session.member.id));
    return json({ members });
  }

  if (request.method !== "POST") return null;
  requireCsrf(request, session);
  requireOwner(session);
  if ((family.memberIds || []).length >= MAX_FAMILY_MEMBERS) {
    return errorJson(`一个家庭最多保留 ${MAX_FAMILY_MEMBERS} 个登录成员`, 409, "member_limit");
  }

  const body = await readJson(request);
  const username = assertUsername(body.username);
  const password = assertPassword(body.password);
  const role = managedRole(body.role);
  const uKey = await usernameKey(username);
  if (await env.SCORE_KV.get(uKey)) return errorJson("该账号已存在", 409, "username_exists");

  const memberId = id("mem");
  const iterations = Math.max(10000, Math.min(500000, Number(env.PASSWORD_ITERATIONS) || 20000));
  const member = {
    schemaVersion: 1,
    id: memberId,
    familyId: family.id,
    username,
    role,
    password: await hashPassword(password, env.AUTH_PEPPER, iterations),
    sessionVersion: 1,
    createdAt: now(),
    disabledAt: null
  };
  const updatedFamily = {
    ...family,
    memberIds: [...new Set([...(family.memberIds || []), memberId])],
    updatedAt: now()
  };

  await putJson(env, `member:${memberId}`, member);
  await putJson(env, `family:${family.id}`, updatedFamily);
  await putJson(env, uKey, { memberId });
  return json({ member: memberSummary(member, session.member.id) }, 201);
}

export async function handleFamilyMemberPatch(request, env, session, memberId) {
  requireCsrf(request, session);
  requireOwner(session);
  if (memberId === session.member.id) {
    return errorJson("不能在这里修改当前管理员自己的访问权限", 400, "cannot_modify_self");
  }

  const target = await getJson(env, `member:${memberId}`);
  if (!target || target.familyId !== session.member.familyId) return errorJson("找不到这个家庭成员", 404, "member_not_found");
  if (target.role === "owner") return errorJson("不能修改其他家庭管理员", 403, "owner_protected");

  const body = await readJson(request);
  const nextRole = body.role == null ? target.role : managedRole(body.role);
  const nextDisabledAt = body.enabled == null ? target.disabledAt || null : body.enabled ? null : now();
  const changed = nextRole !== target.role || nextDisabledAt !== (target.disabledAt || null);
  const updated = {
    ...target,
    role: nextRole,
    disabledAt: nextDisabledAt,
    sessionVersion: changed ? (target.sessionVersion || 1) + 1 : target.sessionVersion || 1,
    updatedAt: changed ? now() : target.updatedAt
  };
  await putJson(env, `member:${memberId}`, updated);
  return json({ member: memberSummary(updated, session.member.id) });
}

export async function handleFamilyStudentCreate(request, env, session) {
  requireCsrf(request, session);
  requireEditor(session);
  const family = await loadFamily(env, session.member.familyId);
  if ((family.studentIds || []).length >= MAX_FAMILY_STUDENTS) {
    return errorJson(`一个家庭最多保留 ${MAX_FAMILY_STUDENTS} 个孩子资料`, 409, "student_limit");
  }

  const body = await readJson(request);
  const student = newStudent(family.id, body);
  const updatedFamily = {
    ...family,
    studentIds: [...new Set([...(family.studentIds || []), student.id])],
    updatedAt: now()
  };
  await putJson(env, `student:${student.id}`, student);
  await putJson(env, `family:${family.id}`, updatedFamily);
  return json({ student }, 201);
}
