import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const brand = await readFile(new URL("../public/brand-v021.js", import.meta.url), "utf8");
const trajectory = await readFile(new URL("../public/trajectory-v2.js", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const architecture = await readFile(new URL("../docs/ARCHITECTURE.md", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");

test("product shell is branded as 高三坐标", () => {
  assert.match(index, /<title>高三坐标<\/title>/);
  assert.match(index, /<div class="brand-mark">标<\/div>/);
  assert.match(index, /正在准备高三坐标…/);
  assert.match(index, /brand-v021\.js/);
  assert.match(brand, /const PRODUCT_NAME = "高三坐标"/);
  assert.match(brand, /看见现在的位置，也看见一路的变化/);
  assert.match(readme, /^# 高三坐标/m);
  assert.match(architecture, /^# Architecture — 高三坐标/m);
});

test("轨迹 remains a feature concept instead of being mechanically renamed", () => {
  assert.match(trajectory, /高三轨迹/);
  assert.match(trajectory, /分享高三轨迹/);
  assert.doesNotMatch(brand, /家庭坐标|分享高三坐标/);
});

test("brand layer only observes top-level app rerenders", () => {
  assert.match(brand, /observer\.observe\(appRoot, \{ childList: true \}\)/);
  assert.doesNotMatch(brand, /subtree\s*:\s*true/);
  assert.doesNotMatch(brand, /document\.documentElement/);
});

test("v0.2.1 is consistent across package and Worker runtime", () => {
  assert.equal(pkg.version, "0.2.1");
  assert.equal(lock.version, "0.2.1");
  assert.equal(lock.packages[""].version, "0.2.1");
  assert.match(wrangler, /APP_VERSION\s*=\s*"0\.2\.1"/);
  assert.match(pkg.scripts.check, /public\/brand-v021\.js/);
});
