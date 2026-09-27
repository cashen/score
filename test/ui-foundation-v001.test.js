import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const index = await readFile(new URL("public/index.html", root), "utf8");
const foundation = await readFile(new URL("public/css/ui-foundation-v001.css", root), "utf8");
const bundle = await readFile(new URL("public/css/app-v094.css", root), "utf8");

test("v0.14 foundation precedes the scoped share layer", async () => {
  assert.equal((index.match(/<link rel="stylesheet"/g) || []).length, 3);
  assert.match(index, /href="\/css\/app-v094\.css"/);
  assert.match(index, /href="\/css\/ui-foundation-v001\.css"/);
  assert.match(index, /href="\/css\/share-eink-v001\.css"/);
  assert.ok(index.indexOf("app-v094.css") < index.indexOf("ui-foundation-v001.css"));
  assert.ok(index.indexOf("ui-foundation-v001.css") < index.indexOf("share-eink-v001.css"));
  await access(new URL("public/css/ui-foundation-v001.css", root));
  assert.match(bundle, /--score-touch-target:\s*44px/);
});

test("foundation provides one shared visual vocabulary", () => {
  const esc = (value) => value.replace(/[.*+?^$()|[\\]\\\\]/g, "\\$&");
  for (const token of ["--ui-bg", "--ui-surface", "--ui-text", "--ui-text-secondary", "--ui-line", "--ui-accent", "--ui-space-4: 16px", "--ui-radius-md: 14px", "--ui-control-height: 44px"]) {
    assert.match(foundation, new RegExp(esc(token)));
  }
  assert.match(foundation, /--bg:\s*var\(--ui-bg\)/);
  assert.match(foundation, /--accent:\s*var\(--ui-accent\)/);
  assert.doesNotMatch(foundation, /transition:\s*all/);
});

test("touch, focus and display preferences are first-class constraints", () => {
  assert.match(foundation, /--ui-control-height:\s*44px/);
  assert.match(foundation, /@media \(pointer: coarse\)/);
  assert.match(foundation, /:focus-visible/);
  assert.match(foundation, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(foundation, /@media \(prefers-contrast: more\)/);
  assert.match(foundation, /@media \(forced-colors: active\)/);
});

test("foundation is presentation-only", () => {
  assert.doesNotMatch(foundation, /fetch\(|XMLHttpRequest|localStorage|indexedDB|\/api\//);
});


test("v0.14.4 defines one canonical responsive layout scale", () => {
  for (const token of ["--layout-outer:1200px", "--layout-workspace:960px", "--layout-reading:760px", "--layout-measure:640px", "--layout-gutter:clamp(16px,3vw,32px)"]) {
    const esc = token.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
    assert.match(foundation, new RegExp(esc));
  }
  assert.match(foundation, /\.app-main\s*\{[\s\S]*margin-inline:\s*auto/);
  assert.match(foundation, /\.public-shell:not\(\.eink-share\)/);
});
