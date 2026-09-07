import { hashPassword, randomToken, sha256, signSession } from "./lib/crypto.js";
import { assertPassword, assertUsername, normalizeUsername, safeText } from "./lib/model.js";
import { errorJson, json, readJson, sessionCookie } from "./lib/http.js";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_INVITE_HOURS = 72;
const MAX_INVITE_HOURS = 168;
const RECOVERY_LINK_MINUTES = 15;
const INDEX_LIMIT = 40;

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

async function secretHash(raw, env) {
  return sha256(`${String(raw || "")}.${env.AUTH_PEPPER || ""}`);
}

function passwordIterations(env) {
  return Math.max(10000, Math.min(500000, Number(env.PASSWORD_ITERATIONS) || 20000));
}

function requireRuntimeSecrets(env) {
  if (!env.SESSION_SECRET || !env.AUTH_PEPPER) {
    throw Object.assign(new Error("服务端认证 Secret 尚未配置"), { status: 500, code: "runtime_secrets_missing" });
  }
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

async function inviterFamily(env, session) {
  if (session.member.role !== "owner") {
    throw Object.assign(new Error("只有家庭管理员可以邀请新家庭"), { status: 403, code: "owner_required" });
  }
  const family = await getJson(env, `family:${session.member.familyId}`);
  if (!family) throw Object.assign(new Error("家庭资料不存在"), { status: 404, code: "family_not_found" });
  if (family.createdViaInvitationAt) {
    throw Object.assign(new Error("当前家庭没有邀请独立家庭的权限"), { status: 403, code: "invitation_authority_required" });
  }
  return family;
}

function expiresInHours(hours) {
  const resolved = Math.max(1, Math.min(MAX_INVITE_HOURS, Number(hours) || DEFAULT_INVITE_HOURS));
  return new Date(Date.now() + resolved * 60 * 60 * 1000).toISOString();
}

function expired(record) {
  return !record?.expiresAt || Date.now() >= new Date(record.expiresAt).getTime();
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

async function rotateRecoveryCode(member, env) {
  const raw = randomToken(24);
  const updated = {
    ...member,
    recoveryCodeHash: await secretHash(raw, env),
    recoveryCodeRotatedAt: now()
  };
  await putJson(env, `member:${member.id}`, updated);
  return { raw, member: updated };
}

async function readIndex(env, key) {
  return (await getJson(env, key)) || { items: [] };
}

async function writeIndex(env, key, items) {
  await putJson(env, key, { items: items.slice(0, INDEX_LIMIT), updatedAt: now() });
}

async function updateInviteIndex(env, issuerMemberId, inviteId, patch) {
  const key = `invite-index:${issuerMemberId}`;
  const index = await readIndex(env, key);
  await writeIndex(env, key, (index.items || []).map((item) => item.id === inviteId ? { ...item, ...patch } : item));
}

async function handleInviteList(env, session) {
  await inviterFamily(env, session);
  const index = await readIndex(env, `invite-index:${session.member.id}`);
  return json({ allowed: true, invitations: index.items || [] });
}

async function handleInviteCreate(request, env, session) {
  requireCsrf(request, session);
  const family = await inviterFamily(env, session);
  const body = await readJson(request);
  const rawToken = randomToken(32);
  const locator = await secretHash(rawToken, env);
  const createdAt = now();
  const expiresAt = expiresInHours(body.expiresInHours);
  const invite = {
    schemaVersion: 1,
    id: id("inv"),
    issuedByMemberId: session.member.id,
    issuedByFamilyId: family.id,
    createdAt,
    expiresAt,
    usedAt: null,
    acceptedFamilyId: null,
    acceptedMemberId: null
  };
  await putJson(env, `invite:${locator}`, invite);
  const indexKey = `invite-index:${session.member.id}`;
  const index = await readIndex(env, indexKey);
  await writeIndex(env, indexKey, [{ id: invite.id, createdAt, expiresAt, usedAt: null }, ...(index.items || [])]);
  return json({ invitation: { id: invite.id, createdAt, expiresAt }, token: rawToken }, 201);
}

async function findInvite(env, rawToken) {
  if (!rawToken || rawToken.length < 20) return null;
  const locator = await secretHash(rawToken, env);
  const invite = await getJson(env, `invite:${locator}`);
  return invite ? { invite, locator } : null;
}

async function handleInviteInspect(env, rawToken) {
  const found = await findInvite(env, rawToken);
  if (!found || found.invite.usedAt || expired(found.invite)) return errorJson("邀请链接不存在或已失效", 404, "invite_not_found");
  return json({ valid: true, expiresAt: found.invite.expiresAt });
}

async function handleInviteAccept(request, env, rawToken) {
  requireRuntimeSecrets(env);
  const found = await findInvite(env, rawToken);
  if (!found || found.invite.usedAt || expired(found.invite)) return errorJson("邀请链接不存在或已失效", 404, "invite_not_found");

  const body = await readJson(request);
  const username = assertUsername(body.username);
  const password = assertPassword(body.password);
  const uKey = await usernameKey(username);
  if (await env.SCORE_KV.get(uKey)) return errorJson("该账号已存在", 409, "username_exists");

  const familyId = id("fam");
  const memberId = id("mem");
  const studentId = id("stu");
  const createdAt = now();
  const recoveryCode = randomToken(24);
  const member = {
    schemaVersion: 1,
    id: memberId,
    familyId,
    username,
    role: "owner",
    password: await hashPassword(password, env.AUTH_PEPPER, passwordIterations(env)),
    recoveryCodeHash: await secretHash(recoveryCode, env),
    recoveryCodeRotatedAt: createdAt,
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
    createdAt,
    createdViaInvitationAt: createdAt,
    invitedByMemberId: found.invite.issuedByMemberId,
    invitedByFamilyId: found.invite.issuedByFamilyId,
    invitationAuthority: false
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
    deletedAt: null
  };

  // KV is not transactional. Write complete objects before exposing the username mapping.
  await putJson(env, `member:${memberId}`, member);
  await putJson(env, `family:${familyId}`, family);
  await putJson(env, `student:${studentId}`, student);
  await putJson(env, uKey, { memberId });

  const usedAt = now();
  await putJson(env, `invite:${found.locator}`, {
    ...found.invite,
    usedAt,
    acceptedFamilyId: familyId,
    acceptedMemberId: memberId
  });
  await updateInviteIndex(env, found.invite.issuedByMemberId, found.invite.id, { usedAt });

  const session = await createSession(member, env);
  return json({
    ok: true,
    familyId,
    memberId,
    studentId,
    recoveryCode,
    recoveryCodeNotice: "恢复码只显示这一次，请离线保存。以后每次使用恢复码重置密码后都会生成新的恢复码。",
    csrf: session.payload.csrf
  }, 201, { "set-cookie": sessionCookie(session.token) });
}

async function handleMyRecoveryCode(request, env, session) {
  requireCsrf(request, session);
  requireRuntimeSecrets(env);
  const result = await rotateRecoveryCode(session.member, env);
  return json({ recoveryCode: result.raw, notice: "新的恢复码只显示这一次；旧恢复码已经失效。" });
}

async function handleRecoveryCodeReset(request, env) {
  requireRuntimeSecrets(env);
  const body = await readJson(request);
  const username = assertUsername(body.username);
  const newPassword = assertPassword(body.newPassword);
  const mapping = await getJson(env, await usernameKey(username));
  if (!mapping) return errorJson("账号或恢复码无效", 403, "invalid_recovery");
  const member = await getJson(env, `member:${mapping.memberId}`);
  if (!member?.recoveryCodeHash || member.disabledAt) return errorJson("账号或恢复码无效", 403, "invalid_recovery");
  const suppliedHash = await secretHash(body.recoveryCode, env);
  if (suppliedHash !== member.recoveryCodeHash) return errorJson("账号或恢复码无效", 403, "invalid_recovery");

  const rotatedRaw = randomToken(24);
  const updated = {
    ...member,
    password: await hashPassword(newPassword, env.AUTH_PEPPER, passwordIterations(env)),
    recoveryCodeHash: await secretHash(rotatedRaw, env),
    recoveryCodeRotatedAt: now(),
    sessionVersion: member.sessionVersion + 1,
    passwordChangedAt: now(),
    sessionsRevokedAt: now()
  };
  await putJson(env, `member:${member.id}`, updated);
  return json({ ok: true, recoveryCode: rotatedRaw, notice: "密码已重置，所有旧登录会话已失效。新的恢复码只显示这一次。" });
}

async function handleRecoveryLinkCreate(request, env, session) {
  requireCsrf(request, session);
  await inviterFamily(env, session);
  const body = await readJson(request);
  const username = assertUsername(body.username);
  const mapping = await getJson(env, await usernameKey(username));
  const targetMember = mapping ? await getJson(env, `member:${mapping.memberId}`) : null;
  const targetFamily = targetMember ? await getJson(env, `family:${targetMember.familyId}`) : null;
  if (!targetMember || targetMember.role !== "owner" || !targetFamily || targetFamily.invitedByMemberId !== session.member.id) {
    return errorJson("找不到由你邀请且可协助恢复的家庭账号", 404, "recoverable_account_not_found");
  }

  const rawToken = randomToken(32);
  const locator = await secretHash(rawToken, env);
  const createdAt = now();
  const expiresAt = new Date(Date.now() + RECOVERY_LINK_MINUTES * 60 * 1000).toISOString();
  const record = {
    schemaVersion: 1,
    id: id("rec"),
    targetMemberId: targetMember.id,
    targetUsername: targetMember.username,
    issuedByMemberId: session.member.id,
    issuedByFamilyId: session.member.familyId,
    createdAt,
    expiresAt,
    usedAt: null
  };
  await putJson(env, `recovery-link:${locator}`, record);
  const key = `recovery-index:${session.member.id}`;
  const index = await readIndex(env, key);
  await writeIndex(env, key, [{ id: record.id, username: targetMember.username, createdAt, expiresAt, usedAt: null }, ...(index.items || [])]);
  return json({ recovery: { id: record.id, username: targetMember.username, createdAt, expiresAt }, token: rawToken }, 201);
}

async function findRecoveryLink(env, rawToken) {
  if (!rawToken || rawToken.length < 20) return null;
  const locator = await secretHash(rawToken, env);
  const record = await getJson(env, `recovery-link:${locator}`);
  return record ? { record, locator } : null;
}

async function handleRecoveryLinkInspect(env, rawToken) {
  const found = await findRecoveryLink(env, rawToken);
  if (!found || found.record.usedAt || expired(found.record)) return errorJson("重置链接不存在或已失效", 404, "recovery_link_not_found");
  return json({ valid: true, expiresAt: found.record.expiresAt });
}

async function updateRecoveryIndex(env, issuerMemberId, recoveryId, patch) {
  const key = `recovery-index:${issuerMemberId}`;
  const index = await readIndex(env, key);
  await writeIndex(env, key, (index.items || []).map((item) => item.id === recoveryId ? { ...item, ...patch } : item));
}

async function handleRecoveryLinkReset(request, env, rawToken) {
  requireRuntimeSecrets(env);
  const found = await findRecoveryLink(env, rawToken);
  if (!found || found.record.usedAt || expired(found.record)) return errorJson("重置链接不存在或已失效", 404, "recovery_link_not_found");
  const body = await readJson(request);
  const newPassword = assertPassword(body.newPassword);
  const member = await getJson(env, `member:${found.record.targetMemberId}`);
  if (!member || member.disabledAt) return errorJson("账号不可恢复", 404, "account_not_found");

  const rotatedRaw = randomToken(24);
  const changedAt = now();
  const updated = {
    ...member,
    password: await hashPassword(newPassword, env.AUTH_PEPPER, passwordIterations(env)),
    recoveryCodeHash: await secretHash(rotatedRaw, env),
    recoveryCodeRotatedAt: changedAt,
    sessionVersion: member.sessionVersion + 1,
    passwordChangedAt: changedAt,
    sessionsRevokedAt: changedAt
  };
  await putJson(env, `member:${member.id}`, updated);
  await putJson(env, `recovery-link:${found.locator}`, { ...found.record, usedAt: changedAt });
  await updateRecoveryIndex(env, found.record.issuedByMemberId, found.record.id, { usedAt: changedAt });
  return json({ ok: true, recoveryCode: rotatedRaw, notice: "密码已重置，旧会话和这条重置链接均已失效。新的恢复码只显示这一次。" });
}

export async function routePublicOnboarding(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  const inviteAccept = path.match(/^\/api\/invitations\/([^/]+)\/accept$/);
  if (request.method === "POST" && inviteAccept) return handleInviteAccept(request, env, decodeURIComponent(inviteAccept[1]));
  const inviteInspect = path.match(/^\/api\/invitations\/([^/]+)$/);
  if (request.method === "GET" && inviteInspect) return handleInviteInspect(env, decodeURIComponent(inviteInspect[1]));

  if (request.method === "POST" && path === "/api/recovery/code") return handleRecoveryCodeReset(request, env);

  const recoveryMatch = path.match(/^\/api\/recovery\/reset\/([^/]+)$/);
  if (request.method === "GET" && recoveryMatch) return handleRecoveryLinkInspect(env, decodeURIComponent(recoveryMatch[1]));
  if (request.method === "POST" && recoveryMatch) return handleRecoveryLinkReset(request, env, decodeURIComponent(recoveryMatch[1]));

  return null;
}

export async function routePrivateOnboarding(request, env, session) {
  const path = new URL(request.url).pathname;

  if (path === "/api/admin/invitations" && request.method === "GET") return handleInviteList(env, session);
  if (path === "/api/admin/invitations" && request.method === "POST") return handleInviteCreate(request, env, session);
  if (path === "/api/admin/recovery-links" && request.method === "POST") return handleRecoveryLinkCreate(request, env, session);
  if (path === "/api/me/recovery-code" && request.method === "POST") return handleMyRecoveryCode(request, env, session);

  return null;
}
