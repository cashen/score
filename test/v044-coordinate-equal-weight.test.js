import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../public/ui-v042.css", import.meta.url), "utf8");
const ui = await readFile(new URL("../public/ui-v042.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("school rank class rank and total score are peer coordinate items", () => {
  assert.match(ui, /class=\"v44-coordinate-row\"/);
  assert.match(ui, /class=\"v44-coordinate-item\"/);
  assert.match(ui, /metrics\.map/);
  assert.match(ui, /schoolRank/);
  assert.match(ui, /classRank/);
  assert.match(ui, /source\.total/);
  assert.doesNotMatch(ui, /<strong>\$\{v42Esc\(primary\)\}<\/strong>/);
});

test("all coordinate metrics share one typography token and stay smaller than the name", () => {
  assert.match(css, /\.v41-current-coordinate > h1[\s\S]*font-size:\s*30px/);
  assert.match(css, /\.v44-coordinate-item[\s\S]*font-size:\s*24px/);
  assert.match(css, /\.v44-coordinate-item[\s\S]*font-weight:\s*650/);
  assert.match(css, /\.v44-coordinate-item[\s\S]*color:\s*var\(--text\)/);
  assert.doesNotMatch(css, /\.v44-coordinate-item[^}]*font-size:\s*(?:3[0-9]|4[0-9]|[5-9][0-9])px/);
});

test("coordinate items use subtle dividers and natural wrapping", () => {
  assert.match(css, /\.v44-coordinate-row[\s\S]*flex-wrap:\s*wrap/);
  assert.match(css, /\.v44-coordinate-item \+ \.v44-coordinate-item[\s\S]*border-left:\s*1px solid var\(--line\)/);
  assert.doesNotMatch(css, /white-space:\s*nowrap/);
});

test("mobile coordinate metrics remain peer-sized below the mobile name", () => {
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v41-current-coordinate > h1[\s\S]*font-size:\s*26px/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v44-coordinate-item[\s\S]*font-size:\s*20px/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*\.v44-coordinate-item[\s\S]*font-size:\s*19px/);
});

test("optional school percentile stays inside the school metric instead of becoming a hero", () => {
  assert.match(ui, /metrics\.push\(source\.schoolPct \? `\$\{schoolRank\} · \$\{source\.schoolPct\}` : schoolRank\)/);
  assert.match(ui, /metrics\.push\(`校\$\{source\.schoolPct\}`\)/);
});

test("release version is exactly 0.4.4", () => {
  assert.equal(pkg.version, "0.4.4");
  assert.equal(lock.version, "0.4.4");
  assert.equal(lock.packages[""].version, "0.4.4");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.4\.4"/);
});
