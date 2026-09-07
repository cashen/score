import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../public/ui-v042.css", import.meta.url), "utf8");
const ui = await readFile(new URL("../public/ui-v042.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("exam coordinate remains a naturally wrapping row", () => {
  assert.match(css, /\.v44-coordinate-row\s*\{[\s\S]*display:\s*flex/);
  assert.match(css, /\.v44-coordinate-row\s*\{[\s\S]*flex-wrap:\s*wrap/);
  assert.match(css, /align-items:\s*baseline/);
  assert.doesNotMatch(css, /white-space:\s*nowrap/);
});

test("semantic coordinate content still includes school rank class rank and score", () => {
  assert.match(ui, /const schoolRank = v42CompactRank\("校"/);
  assert.match(ui, /const classRank = v42CompactRank\("班"/);
  assert.match(ui, /metrics\.push\(classRank\)/);
  assert.match(ui, /metrics\.push\(`\$\{source\.total\} 分`\)/);
});

test("v0.4 coordinate-row contract remains in the same runtime family", () => {
  assert.match(pkg.version, /^0\.4\./);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.match(wrangler, new RegExp(`APP_VERSION\\s*=\\s*"${pkg.version.replaceAll(".", "\\.")}"`));
});
