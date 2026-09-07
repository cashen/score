import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../public/ui-v042.css", import.meta.url), "utf8");
const ui = await readFile(new URL("../public/ui-v042.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("exam coordinate uses one wrapping flex row instead of forced stacked layout", () => {
  assert.match(css, /\.v41-coordinate-primary\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.v41-coordinate-primary\s*\{[\s\S]*flex-wrap:\s*wrap/);
  assert.match(css, /align-items:\s*baseline/);
  assert.match(css, /\.v41-coordinate-primary > em[\s\S]*flex:\s*0 0 100%/);
  assert.match(css, /\.v41-coordinate-primary > strong[\s\S]*flex:\s*0 0 auto/);
  assert.match(css, /\.v41-coordinate-primary > span[\s\S]*flex:\s*0 1 auto/);
});

test("semantic coordinate content still groups class rank and score behind school rank", () => {
  assert.match(ui, /const meta = \[\]/);
  assert.match(ui, /meta\.push\(classRank\)/);
  assert.match(ui, /meta\.push\(`\$\{source\.total\} 分`\)/);
  assert.match(ui, /meta\.join\(" · "\)/);
});

test("mobile remains naturally wrappable and does not reintroduce oversized coordinate text", () => {
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v41-coordinate-primary[\s\S]*column-gap: 10px/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.v41-coordinate-primary > strong[\s\S]*font-size: 36px/);
  assert.match(css, /@media \(max-width: 380px\)[\s\S]*font-size: 34px/);
  assert.doesNotMatch(css, /white-space:\s*nowrap/);
});

test("release version is exactly 0.4.3", () => {
  assert.equal(pkg.version, "0.4.3");
  assert.equal(lock.version, "0.4.3");
  assert.equal(lock.packages[""].version, "0.4.3");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.4\.3"/);
});
