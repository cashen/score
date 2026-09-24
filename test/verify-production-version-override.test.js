import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyProduction } from "../scripts/verify-production.mjs";

test("production verification pins every request to the deployed Worker version", async () => {
  const publicRoot = resolve("public");
  const index = await readFile(resolve(publicRoot, "index.html"));
  const buildSha = "a".repeat(40);
  const versionId = "b19112bf-b6c5-410b-86bb-b00a57551454";
  const headersSeen = [];

  const fetchFn = async (url, options = {}) => {
    headersSeen.push(options.headers || {});
    const path = new URL(url).pathname;
    if (path === "/api/health") {
      return new Response(JSON.stringify({
        ok: true,
        appVersion: "0.12.29.12",
        buildSha,
        schemaVersion: 1,
        storage: "workers-kv"
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    const filePath = path === "/" ? resolve(publicRoot, "index.html") : resolve(publicRoot, "." + path);
    return new Response(await readFile(filePath), { status: 200 });
  };

  await verifyProduction({
    origin: "https://score-track.cashen.workers.dev",
    buildSha,
    version: "0.12.29.12",
    versionId,
    publicRoot,
    fetchFn
  });

  assert.ok(index.length > 0);
  assert.ok(headersSeen.length > 0);
  for (const headers of headersSeen) {
    assert.equal(headers["Cloudflare-Workers-Version-Overrides"], "score-track=\"" + versionId + "\"");
  }
});
