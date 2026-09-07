import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const ui = await readFile(new URL("../public/ui-v042.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v042.css", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("v0.4.2 assets are wired after v0.4.1 and syntax checked", () => {
  assert.match(index, /ui-v042\.css/);
  assert.match(index, /ui-v042\.js/);
  assert.ok(index.indexOf("ui-v042.css") > index.indexOf("ui-v041.css"));
  assert.ok(index.indexOf("ui-v042.js") > index.indexOf("ui-v041.js"));
  assert.match(pkg.scripts.check, /public\/ui-v042\.js/);
});

test("coordinate remains one direct semantic unit instead of field-label plus giant number", () => {
  assert.match(ui, /v42CompactRank/);
  assert.match(ui, /`\$\{prefix\}第 \$\{named\[1\]\} 名`/);
  assert.match(ui, /const schoolRank = v42CompactRank\("校"/);
  assert.match(ui, /const classRank = v42CompactRank\("班"/);
  assert.match(ui, /metrics\.push\(classRank\)/);
  assert.match(ui, /metrics\.push\(`\$\{source\.total\} 分`\)/);
  assert.match(ui, /source\.exam/);
});

test("typography caps prevent a ranking-poster hierarchy before JS finishes", () => {
  assert.match(css, /\.v41-current-coordinate > h1[\s\S]*font-size: 30px/);
  assert.match(css, /\.v41-coordinate-primary > small[\s\S]*display: none/);
  assert.match(css, /\.v41-coordinate-primary > strong,[\s\S]*\.v44-coordinate-item[\s\S]*font-size: 24px/);
  assert.match(css, /\.subject-card \.score[\s\S]*font-size: 26px/);
  assert.doesNotMatch(css, /v44-coordinate-item[^}]*font-size:\s*(?:3[0-9]|4[0-9]|[5-9][0-9])px/);
});

test("subject area steps down from the coordinate surface and mobile becomes six compact rows", () => {
  assert.match(css, /\.v41-current-coordinate \.subject-grid[\s\S]*background: var\(--surface\)/);
  assert.match(css, /\.v41-current-coordinate \.subject-card[\s\S]*min-height: 92px/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v41-current-coordinate \.subject-grid[\s\S]*grid-template-columns: 1fr/);
  assert.match(css, /grid-template-columns: 64px 68px minmax\(0, 1fr\)/);
  assert.match(css, /min-height: 52px/);
});

test("public report width and mobile reading order are intentionally bounded", () => {
  assert.match(css, /--v42-report-max: 960px/);
  assert.match(css, /\.public-shell[\s\S]*max-width: var\(--v42-report-max\)/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*padding-inline: 12px/);
  assert.match(css, /\.v41-coordinate-primary > em[\s\S]*display: block/);
  assert.match(css, /\.v44-coordinate-row[\s\S]*flex-wrap: wrap/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v44-coordinate-item[\s\S]*font-size: 20px/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*\.v44-coordinate-item[\s\S]*font-size: 19px/);
});

test("v0.4.2 enhancement keeps DOM observation narrow", () => {
  assert.match(ui, /observer\.observe\(v42App, \{ childList: true \}\)/);
  assert.doesNotMatch(ui, /subtree\s*:\s*true/);
  assert.doesNotMatch(ui, /document\.documentElement/);
});

test("v0.4 typography contract remains within the same runtime family", () => {
  assert.match(pkg.version, /^0\.4\./);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.match(wrangler, new RegExp(`APP_VERSION\\s*=\\s*"${pkg.version.replaceAll(".", "\\.")}"`));
});
