import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { errorJson } from "../src/lib/http.js";
import { sessionStorageKey } from "../src/lib/crypto.js";
import { claimOneTime, consumeOneTime, releaseOneTime } from "../src/security-gate.js";

class MockGate {
  constructor() { this.state = new Map(); }
  getByName(name) {
    return {
      claim: async () => {
        const current = this.state.get(name);
        if (current?.status === "claimed" || current?.status === "consumed") return null;
        const claimId = "claim-" + name;
        this.state.set(name, { status: "claimed", claimId });
        return claimId;
      },
      consume: async (claimId) => {
        const current = this.state.get(name);
        if (current?.status !== "claimed" || current.claimId !== claimId) return false;
        this.state.set(name, { status: "consumed" });
        return true;
      },
      release: async (claimId) => {
        const current = this.state.get(name);
        if (current?.status !== "claimed" || current.claimId !== claimId) return false;
        this.state.delete(name);
        return true;
      }
    };
  }
}

test("429 responses preserve Retry-After for callers", async () => {
  const response = errorJson("请求过于频繁，请稍后再试", 429, "rate_limited", null, { "retry-after": "37" });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "37");
});

test("one-time gate helper serializes and consumes a credential", async () => {
  const env = { ONE_TIME_GATE: new MockGate() };
  const first = await claimOneTime(env, "invite", "locator-a");
  assert.equal(typeof first, "string");
  assert.equal(await claimOneTime(env, "invite", "locator-a"), null);
  assert.equal(await consumeOneTime(env, "invite", "locator-a", first), true);
  assert.equal(await claimOneTime(env, "invite", "locator-a"), null);
  const second = await claimOneTime(env, "invite", "locator-b");
  assert.equal(await releaseOneTime(env, "invite", "locator-b", second), true);
  assert.equal(typeof await claimOneTime(env, "invite", "locator-b"), "string");
});

test("session storage keys are one-way and namespaced", async () => {
  const a = await sessionStorageKey("jti-a");
  const b = await sessionStorageKey("jti-b");
  assert.notEqual(a, b);
  assert.match(a, /^session:[a-f0-9]{64}$/);
});

test("coordinate insight escapes persisted exam names before DOM insertion", async () => {
  const source = await readFile(new URL("../public/coordinate-insight-v100.js", import.meta.url), "utf8");
  assert.match(source, /function esc\(value = ""\)/);
  assert.match(source, /esc\(result\.latest\.name\)/);
  assert.match(source, /esc\(result\.previous\.name\)/);
});

test("new Secret Share links keep raw tokens in URL fragments and redeem via POST", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(source, /\/share\/#\$\{encodeURIComponent\(result\.token\)\}/);
  assert.match(source, /\/api\/share\/secret\/redeem/);
  assert.match(source, /history\.replaceState\(null, "", location\.pathname \+ location\.search\)/);
});

test("bootstrap is covered by the same one-time gate namespace", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.match(source, /claimOneTime\(env, "bootstrap", "root"\)/);
  assert.match(source, /consumeOneTime\(env, "bootstrap", "root", claimId\)/);
});

test("v020 gateway checks session jti revocation", async () => {
  const source = await readFile(new URL("../src/v020.js", import.meta.url), "utf8");
  assert.match(source, /sessionStorageKey/);
  assert.match(source, /payload\.jti/);
});

test("production configuration disables bootstrap and enables the one-time gate", async () => {
  const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(wrangler, /BOOTSTRAP_ENABLED = "false"/);
  assert.match(wrangler, /name = "ONE_TIME_GATE"/);
  assert.match(wrangler, /class_name = "OneTimeCredentialGate"/);
  assert.match(wrangler, /new_sqlite_classes = \["OneTimeCredentialGate"\]/);
  assert.match(wrangler, /invocation_logs = false/);
});

test("release is v0.12.28.7", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, "0.12.28.7");
});
