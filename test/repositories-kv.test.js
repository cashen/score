import test from "node:test";
import assert from "node:assert/strict";
import { getManyJson } from "../src/repositories/kv.js";

class BulkKV {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
    this.bulkCalls = [];
    this.singleCalls = [];
  }

  async get(key, type) {
    if (Array.isArray(key)) {
      this.bulkCalls.push([...key]);
      const result = new Map();
      for (const item of key) {
        if (!this.values.has(item)) continue;
        const value = this.values.get(item);
        result.set(item, type === "json" ? JSON.parse(value) : value);
      }
      return result;
    }
    this.singleCalls.push(key);
    if (!this.values.has(key)) return null;
    const value = this.values.get(key);
    return type === "json" ? JSON.parse(value) : value;
  }
}

class LegacyKV extends BulkKV {
  async get(key, type) {
    if (Array.isArray(key)) throw new TypeError("bulk get is not supported by this test double");
    return super.get(key, type);
  }
}

test("bulk JSON reads deduplicate keys and preserve missing values", async () => {
  const env = { SCORE_KV: new BulkKV({ a: JSON.stringify({ value: 1 }), b: JSON.stringify({ value: 2 }) }) };
  const result = await getManyJson(env, ["a", "b", "a", "", null, "missing"]);

  assert.deepEqual(result.get("a"), { value: 1 });
  assert.deepEqual(result.get("b"), { value: 2 });
  assert.equal(result.get("missing"), null);
  assert.equal(result.size, 3);
  assert.deepEqual(env.SCORE_KV.bulkCalls, [["a", "b", "missing"]]);
  assert.deepEqual(env.SCORE_KV.singleCalls, []);
});

test("bulk JSON reads split at Cloudflare's 100-key binding batch size", async () => {
  const values = Object.fromEntries(Array.from({ length: 205 }, (_, index) => ["k" + index, JSON.stringify(index)]));
  const env = { SCORE_KV: new BulkKV(values) };
  const keys = Object.keys(values);
  const result = await getManyJson(env, keys);

  assert.equal(result.size, 205);
  assert.equal(result.get("k0"), 0);
  assert.equal(result.get("k204"), 204);
  assert.deepEqual(env.SCORE_KV.bulkCalls.map((batch) => batch.length), [100, 100, 5]);
  assert.equal(env.SCORE_KV.singleCalls.length, 0);
});

test("legacy/local KV doubles fall back to bounded individual JSON reads", async () => {
  const env = { SCORE_KV: new LegacyKV({ a: JSON.stringify(1), b: JSON.stringify(2) }) };
  const result = await getManyJson(env, ["a", "b"]);

  assert.equal(result.get("a"), 1);
  assert.equal(result.get("b"), 2);
  assert.equal(env.SCORE_KV.bulkCalls.length, 0);
  assert.deepEqual(env.SCORE_KV.singleCalls, ["a", "b"]);
});

test("empty bulk JSON input performs no KV operation", async () => {
  const env = { SCORE_KV: new BulkKV() };
  const result = await getManyJson(env, []);

  assert.equal(result.size, 0);
  assert.equal(env.SCORE_KV.bulkCalls.length, 0);
  assert.equal(env.SCORE_KV.singleCalls.length, 0);
});
