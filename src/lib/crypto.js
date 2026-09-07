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

export async function hashPassword(password, pepper, iterations = 20000, salt = randomToken(18)) {
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
    version: 1,
    iterations,
    salt,
    hash: toBase64Url(new Uint8Array(bits))
  };
}

export async function verifyPassword(password, pepper, record) {
  if (!record || record.algorithm !== "PBKDF2-SHA256" || record.version !== 1) return false;
  const candidate = await hashPassword(password, pepper, record.iterations, record.salt);
  const a = fromBase64Url(candidate.hash);
  const b = fromBase64Url(record.hash);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
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
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i += 1) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(body)));
    if (!payload.exp || Date.now() >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
