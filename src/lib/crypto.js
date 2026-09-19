const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return toBase64Url(data);
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function deriveDomainSecret(masterSecret, domain) {
  if (!masterSecret) throw new Error("域密钥尚未配置");
  return hmacHex(masterSecret, `score-domain-v1:${domain}`);
}

export async function deriveCompositeDomainSecret(primarySecret, secondarySecret, domain) {
  if (!primarySecret || !secondarySecret) throw new Error("复合域密钥尚未配置");
  return hmacHex(primarySecret, `${secondarySecret}\u0000score-domain-v2:${domain}`);
}

export async function tokenHash(raw, env, domain = "token") {
  const secret = env.TOKEN_PEPPER || await deriveCompositeDomainSecret(env.AUTH_PEPPER, env.SESSION_SECRET, domain);
  return hmacHex(secret, String(raw || ""));
}

export function timingSafeEqualText(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export function timingSafeEqualBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPassword(password, pepper, iterations = 600000, salt = randomToken(18)) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${password}\u0000${pepper}`),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations },
    material,
    256
  );
  return {
    algorithm: "PBKDF2-SHA256",
    version: 2,
    iterations,
    salt,
    hash: toBase64Url(new Uint8Array(bits))
  };
}

export async function verifyPassword(password, pepper, record) {
  if (!record || record.algorithm !== "PBKDF2-SHA256" || ![1, 2].includes(record.version)) return false;
  const candidate = await hashPassword(password, pepper, record.iterations, record.salt);
  const a = fromBase64Url(candidate.hash);
  const b = fromBase64Url(record.hash);
  return timingSafeEqualBytes(a, b);
}

export async function signSession(payload, secret) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await hmacHex(secret, body);
  return `${body}.${sig}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = await hmacHex(secret, body);
  if (!timingSafeEqualText(sig, expected)) return null;
  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(body)));
    if (!payload.exp || Date.now() >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}