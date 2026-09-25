import test from "node:test";
import assert from "node:assert/strict";
import { getJson, putJson, REPOSITORY_ARCHITECTURE_VERSION } from "../src/repositories/kv.js";

test("repository boundary centralizes KV JSON serialization", async () => {
  const calls = [];
  const env = { SCORE_KV: {
    async get(key, type) { calls.push(["get", key, type]); return { ok: true }; },
    async put(key, value) { calls.push(["put", key, value]); }
  } };
  assert.deepEqual(await getJson(env, "exam:x"), { ok: true });
  await putJson(env, "exam:x", { score: 100 });
  assert.deepEqual(calls, [["get", "exam:x", "json"], ["put", "exam:x", "{\"score\":100}"]]);
  assert.equal(REPOSITORY_ARCHITECTURE_VERSION, "0.13.0");
});
