import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [index, app, onboarding, helper, css] = await Promise.all([
  read("public/index.html"), read("public/app.js"), read("public/onboarding-v050.js"),
  read("public/brand-logo-b.js"), read("public/brand-logo-b.css")
]);

test("Logo B is a source-rendered score record mark", () => {
  assert.match(index, /brand-logo-b\.css/);
  assert.match(index, /data-brand-logo="score-record"/);
  assert.match(helper, /brand-logo-page/);
  assert.match(helper, /brand-logo-track/);
  assert.equal((helper.match(/class="brand-logo-node(?: brand-logo-node-current)?"/g) || []).length, 3);
  assert.match(helper, /brand-logo-sweat/);
  assert.doesNotMatch(index, /<div class="brand-mark">标<\/div>/);
  assert.doesNotMatch(app, /<div class="brand-mark">标<\/div>/);
  assert.doesNotMatch(onboarding, /<div class="brand-mark">标<\/div>/);
});

test("Logo B stays restrained, scalable and preference-safe", () => {
  assert.match(css, /\.brand-mark-score/);
  assert.match(css, /background:\s*transparent/);
  assert.match(css, /@media \(prefers-contrast: more\)/);
  assert.doesNotMatch(css, /gradient|animation|transition|url\(/i);
});
