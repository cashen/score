import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyProduction } from "../scripts/verify-production.mjs";

test("verifyProduction adds Cloudflare Worker version override to every request", async () => {
  const publicRoot = resolve("public");
  const buildSha = "a".repeat(40);
  const versionId = "27f10cc2-874d-4507-a566-f4c5d2381c92";
  const headersSeen = [];
  const fetchFn = async (url, options = {}) => {
    headersSeen.push(options.headers || {});
    const path = new URL(url).pathname;
    if (path === "/api/health") {
      return new Response(JSON.stringify({ ok:true, appVersion:"0.13.5.1", buildSha, schemaVersion:1, storage:"workers-kv" }), {status:200,headers:{"content-type":"application/json"}});
    }
    if (path.startsWith("/api/")) return new Response("", { status: 404 });
    const candidate = resolve(publicRoot, path.replace(/^\//, ""));
    try {
      await access(candidate);
      return new Response(await readFile(candidate), { status: 200 });
    } catch {
      return new Response(await readFile(resolve(publicRoot, "index.html")), { status: 200 });
    }
  };
  await verifyProduction({origin:"https://score-track.cashen.workers.dev",buildSha,version:"0.13.5.1",versionId,publicRoot,fetchFn});
  assert.ok(headersSeen.length > 0);
  for (const headers of headersSeen) assert.equal(headers["Cloudflare-Workers-Version-Overrides"], "score-track=\"" + versionId + "\"");
});
