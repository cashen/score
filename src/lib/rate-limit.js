import { sha256 } from "./crypto.js";

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Real-IP") || "unknown";
}

async function read(env, key) {
  return env.SCORE_KV.get(key, "json");
}

async function write(env, key, value, ttlSeconds) {
  await env.SCORE_KV.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
}

async function consume(env, key, max, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const current = await read(env, key);
  if (!current || typeof current !== "object" || current.resetAt <= now) {
    await write(env, key, { count: 1, resetAt: now + windowSeconds }, windowSeconds + 60);
    return { allowed: true, retryAfter: windowSeconds };
  }
  if (current.count >= max) return { allowed: false, retryAfter: Math.max(1, current.resetAt - now) };
  await write(env, key, { count: current.count + 1, resetAt: current.resetAt }, Math.max(60, current.resetAt - now + 60));
  return { allowed: true, retryAfter: Math.max(1, current.resetAt - now) };
}

export async function enforceRateLimit(env, request, {
  scope,
  identity = "",
  identityMax = 8,
  ipMax = 40,
  windowSeconds = 600
}) {
  const ip = clientIp(request);
  const keys = [
    [`rate:${scope}:ip:${await sha256(ip)}`, ipMax],
    identity ? [`rate:${scope}:id:${await sha256(String(identity).trim().toLowerCase())}`, identityMax] : null
  ].filter(Boolean);

  for (const [key, max] of keys) {
    const result = await consume(env, key, max, windowSeconds);
    if (!result.allowed) {
      throw Object.assign(new Error("请求过于频繁，请稍后再试"), {
        status: 429,
        code: "rate_limited",
        retryAfter: result.retryAfter
      });
    }
  }
}

export function rateLimitHeaders(retryAfter) {
  return { "retry-after": String(Math.max(1, Number(retryAfter) || 60)) };
}