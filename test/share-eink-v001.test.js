import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
const shareApp = fs.readFileSync(path.join(root, "public/share-app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "public/css/share-eink-v001.css"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const wrangler = fs.readFileSync(path.join(root, "wrangler.toml"), "utf8");

test("share page uses the independent E-ink visual root", () => {
  assert.match(shareApp, /share-eink-root/);
  assert.match(shareApp, /public-shell eink-share/);
  assert.doesNotMatch(shareApp, /ink-share-flourish/);
  assert.match(index, /share-eink-v001\.css/);
});

test("E-ink share system is a calm grayscale reading layer", () => {
  assert.match(css, /--eink-bg/);
  assert.match(css, /--eink-reading-width/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /prefers-contrast: more/);
  assert.match(css, /forced-colors: active/);
  assert.doesNotMatch(css, /repeating-linear-gradient/);
  assert.doesNotMatch(css, /box-shadow:\s*0\s+\d/);
});

test("release version is synchronized for E-ink share", () => {
  assert.equal(pkg.version, "0.15.2.0");
  assert.match(wrangler, /^APP_VERSION\s*=\s*"0\.15\.1\.0"/m);
});


test("v0.15 share alignment keeps the reading frame centered", () => {
  assert.match(css, /--eink-reading-width:\s*760px/);
  assert.match(css, /--eink-body-measure:\s*40rem/);
  assert.match(css, /\.eink-share > \.public-coordinate/);
  assert.match(css, /margin-inline:\s*auto/);
  assert.match(css, /@media \(max-width:760px\)/);
});
