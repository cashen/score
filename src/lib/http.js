export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extraHeaders }
  });
}

export function errorJson(message, status = 400, code = "bad_request", field = null) {
  return json({ error: code, message, ...(field ? { field } : {}) }, status);
}

export async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("请求必须使用 application/json");
  const text = await request.text();
  if (text.length > 150000) throw new Error("请求数据过大");
  return JSON.parse(text || "{}");
}

export function parseCookies(request) {
  const result = {};
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

export function sessionCookie(token, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return `score_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie() {
  return "score_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";
}

export function securityHeaders(headers = new Headers()) {
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
  headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return headers;
}

export function withSecurity(response, { noStore = false } = {}) {
  const headers = securityHeaders(new Headers(response.headers));
  if (noStore) headers.set("cache-control", "private, no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
