import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { references, verifyProduction } from "../scripts/verify-production.mjs";
const sha = "a".repeat(40);
const options = { origin: "https://test.invalid", buildSha: sha, version: "0.8.1", publicRoot: resolve("public") };
function mock({ badSha = false, staleAsset = false } = {}) {
  return async url => {
    if (url.pathname === "/api/health") return Response.json({ ok: true, appVersion: "0.8.1", buildSha: badSha ? "b".repeat(40) : sha, schemaVersion: 1, storage: "workers-kv" });
    if (staleAsset && url.pathname === "/app.js") return new Response("stale app");
    const index = url.pathname === "/" || /^\/(share|p)\//.test(url.pathname);
    return new Response(await readFile(resolve("public", index ? "index.html" : `.${url.pathname}`)));
  };
}
test("production proof follows both static and dynamic module imports", async () => {
  assert.deepEqual(references('import "./draft.js"; import { a } from "./core.js"; await import("./app.js")', "/router.js"), ["/draft.js", "/core.js", "/app.js"]);
  const result = await verifyProduction({ ...options, fetchFn: mock() });
  assert(result.assets.some(asset => asset.path === "/trajectory-core-v060.js"));
  assert(result.assets.some(asset => asset.path === "/ui-v081-share-ink.css"));
  assert.equal(result.entries, 3);
});
test("production proof rejects stale health SHA", async () => {
  await assert.rejects(verifyProduction({ ...options, fetchFn: mock({ badSha: true }) }));
});
test("production proof rejects stale bytes even with correct health", async () => {
  await assert.rejects(verifyProduction({ ...options, fetchFn: mock({ staleAsset: true }) }), /Asset bytes mismatch/);
});
