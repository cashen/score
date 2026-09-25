/** Storage boundary: application/domain code should not own KV serialization details. */
export async function getJson(env, key) {
  return env.SCORE_KV.get(key, "json");
}

export async function putJson(env, key, value, options) {
  await env.SCORE_KV.put(key, JSON.stringify(value), options);
}

export async function deleteKey(env, key) {
  await env.SCORE_KV.delete(key);
}

export async function listKeys(env, options = {}) {
  if (typeof env.SCORE_KV.list !== "function") return { keys: [] };
  return env.SCORE_KV.list(options);
}

export const REPOSITORY_ARCHITECTURE_VERSION = "0.13.0";