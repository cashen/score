/** Storage boundary: application/domain code should not own KV serialization details. */
export async function getJson(env, key) {
  return env.SCORE_KV.get(key, "json");
}

export async function putJson(env, key, value, options) {
  await env.SCORE_KV.put(key, JSON.stringify(value), options);
}

/**
 * Read multiple JSON values through the Workers KV bulk-read binding.
 * Cloudflare currently supports up to 100 keys per binding bulk read.
 * A small per-key fallback keeps local/legacy KV doubles usable without
 * changing the production path.
 */
export async function getManyJson(env, keys) {
  const normalized = [...new Set((Array.isArray(keys) ? keys : []).map((key) => String(key || "")).filter(Boolean))];
  if (!normalized.length) return new Map();

  const result = new Map();
  for (let offset = 0; offset < normalized.length; offset += 100) {
    const batch = normalized.slice(offset, offset + 100);
    let values = null;
    try {
      values = await env.SCORE_KV.get(batch, "json");
    } catch {
      values = null;
    }

    if (values instanceof Map) {
      for (const [key, value] of values.entries()) result.set(key, value);
      continue;
    }

    if (values && typeof values === "object" && !Array.isArray(values)) {
      for (const [key, value] of Object.entries(values)) result.set(key, value);
      continue;
    }

    const fallback = await Promise.all(batch.map((key) => env.SCORE_KV.get(key, "json")));
    batch.forEach((key, index) => result.set(key, fallback[index] ?? null));
  }
  return result;
}

export async function deleteKey(env, key) {
  await env.SCORE_KV.delete(key);
}

export async function listKeys(env, options = {}) {
  if (typeof env.SCORE_KV.list !== "function") return { keys: [] };
  return env.SCORE_KV.list(options);
}

export const REPOSITORY_ARCHITECTURE_VERSION = "0.14.5";