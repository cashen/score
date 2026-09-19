import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const onboarding = await readFile(new URL("../public/onboarding-v050.js", import.meta.url), "utf8");

test("高三坐标 brand mark is rendered directly instead of patched at runtime", () => {
  assert.match(index, /<title>高三坐标<\/title>/);
  assert.match(index, /data-brand-logo="score-record"/);
  assert.match(index, /brand-logo-page/);
  assert.match(app, /const PRODUCT_NAME = "高三坐标"/);
  assert.match(app, /看见这次成绩，也看见前后的变化/);
  assert.match(onboarding, /const PRODUCT_NAME = "高三坐标"/);
  assert.match(app, /from "\.\/brand-logo-b\.js"/);
  assert.match(onboarding, /from "\.\/brand-logo-b\.js"/);
  assert.doesNotMatch(app, /<div class="brand-mark">标<\/div>/);
  assert.doesNotMatch(onboarding, /<div class="brand-mark">标<\/div>/);
  assert.doesNotMatch(index, /brand-v021\.js/);
});

test("成绩 is the main reading tab while the product name stays 高三坐标", () => {
  assert.match(app, />成绩<\/button>/);
  assert.match(app, /查看历次考试/);
  assert.doesNotMatch(app, /PRODUCT_NAME\s*=\s*"高三轨迹"/);
});
