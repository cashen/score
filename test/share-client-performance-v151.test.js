import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("v0.15.1 share entry no longer pulls trajectory analysis through the domain facade", async () => {
  const source = await readFile(new URL("../public/share-app.js", import.meta.url), "utf8");
  assert.equal(source.includes('from "./domain-v001.js"'), false);
  assert.equal(source.includes('from "./trajectory-analysis-v010.js"'), false);
  assert.equal(source.includes('await import("./trajectory-analysis-v010.js")'), true);
  assert.equal(source.includes('const body = view === "subject" ? await publicSubjectComparisonV080'), true);
});

test("v0.15.1 share rendering awaits the lazy subject boundary", async () => {
  const source = await readFile(new URL("../public/share-app.js", import.meta.url), "utf8");
  assert.equal(source.includes("async function publicSubjectComparisonV080"), true);
  assert.equal(source.includes("async function renderPublicV080"), true);
  assert.equal(source.includes("await renderPublicV080(result)"), true);
});

test("release version is synchronized for v0.15.1", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const lock = await readFile(new URL("../package-lock.json", import.meta.url), "utf8");
  const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.equal(pkg.version, "0.15.1.0");
  assert.equal(lock.includes('"version": "0.15.1.0"'), true);
  assert.equal(wrangler.includes('APP_VERSION = "0.15.1.0"'), true);
});
