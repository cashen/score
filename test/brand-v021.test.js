import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const onboarding = await readFile(new URL("../public/onboarding-v050.js", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("高三坐标 is rendered directly instead of patched at runtime", () => {
  assert.match(index, /<title>高三坐标<\/title>/);
  assert.match(index, /<div class="brand-mark">标<\/div>/);
  assert.match(app, /const PRODUCT_NAME = "高三坐标"/);
  assert.match(app, /看见现在的位置，也看见一路的变化/);
  assert.match(onboarding, /const PRODUCT_NAME = "高三坐标"/);
  assert.doesNotMatch(index, /brand-v021\.js/);
});

test("轨迹 is a feature word while the product name stays 高三坐标", () => {
  assert.match(app, />轨迹<\/button>/);
  assert.match(app, /查看完整轨迹/);
  assert.doesNotMatch(app, /PRODUCT_NAME\s*=\s*"高三轨迹"/);
});

test("v0.8.0 version sources remain consistent", () => {
  assert.equal(pkg.version, "0.8.0");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.8\.0"/);
  assert.doesNotMatch(pkg.scripts.check, /brand-v021\.js/);
});
