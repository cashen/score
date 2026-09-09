import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const hash = value => createHash("sha256").update(value).digest("hex");
export function references(text, path) {
  const matches = path.endsWith(".html")
    ? [...text.matchAll(/<(?:link|script)\b[^>]*(?:href|src)=["']([^"']+)["']/g)].map(match => match[1])
    : path.endsWith(".js")
      ? [...text.matchAll(/\b(?:import\s*(?:\(\s*)?|from\s*)["']([^"']+)["']/g)].map(match => match[1])
      : [];
  return matches.map(value => {
    const base = new URL(path, "https://assets.invalid");
    const url = new URL(value, base);
    assert.equal(url.origin, base.origin, `Unexpected external asset ${value}`);
    return url.pathname;
  });
}

export async function verifyProduction({ origin, buildSha, version, publicRoot, fetchFn = fetch }) {
  assert.match(buildSha, /^[a-f0-9]{40}$/);
  const get = async path => {
    const url = new URL(path, origin);
    url.searchParams.set("releaseCheck", buildSha);
    const response = await fetchFn(url, { headers: { "cache-control": "no-cache" }, signal: AbortSignal.timeout(20000) });
    assert.equal(response.ok, true, `HTTP ${response.status}: ${path}`);
    return response;
  };
  const health = await (await get("/api/health")).json();
  assert.equal(health.ok, true);
  assert.equal(health.appVersion, version);
  assert.equal(health.buildSha, buildSha);
  assert.equal(health.schemaVersion, 1);
  assert.equal(health.storage, "workers-kv");
  const expectedIndex = await readFile(resolve(publicRoot, "index.html"));
  for (const path of ["/", "/share/release-check-not-a-token", "/p/release-check-not-a-slug"]) {
    const body = Buffer.from(await (await get(path)).arrayBuffer());
    assert.equal(hash(body), hash(expectedIndex), `Entry HTML mismatch: ${path}`);
  }
  const queue = references(expectedIndex.toString(), "/index.html");
  const seen = new Set();
  const assets = [];
  for (let index = 0; index < queue.length; index++) {
    const path = queue[index];
    if (seen.has(path)) continue;
    seen.add(path);
    const expected = await readFile(resolve(publicRoot, `.${path}`));
    const actual = Buffer.from(await (await get(path)).arrayBuffer());
    assert.equal(hash(actual), hash(expected), `Asset bytes mismatch: ${path}`);
    assets.push({ path, sha256: hash(actual) });
    queue.push(...references(expected.toString(), path));
  }
  assert(seen.has("/ui-v081-share-ink.css"), "Missing release stylesheet");
  assert(seen.has("/ui-v100-share-eink.css"), "Missing v0.10 E-ink stylesheet");
  assert(seen.has("/app.js"), "Missing application module");
  return { health, entries: 3, assets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  console.log(JSON.stringify(await verifyProduction({
    origin: "https://score-track.cashen.workers.dev", buildSha: process.argv[2],
    version: pkg.version, publicRoot: resolve("public")
  }), null, 2));
}
