import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const shareApp = await readFile(new URL("../public/share-app.js", import.meta.url), "utf8");
const publicApp = app + "\n" + shareApp;
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/css/share-eink-v001.css", import.meta.url), "utf8");

test("single-exam public views explain the current baseline without inventing a trend", () => {
  assert.match(publicApp, /function publicBaselineV081\(view, exams, share = \{\}\)\s*\{/);
  assert.match(publicApp, /exams\.length !== 1/);
  assert.match(publicApp, /目前的记录/);
  assert.match(publicApp, /现在只记录到这一场考试/);
  assert.doesNotMatch(publicApp, /目前的记录[^]*?(预测|能力判断|必然进步)/);
});

test("the E-ink treatment is scoped to external share rendering", () => {
  assert.match(publicApp, /class="public-shell eink-share"/);
  assert.match(publicApp, /data-share-view=/);
  assert.match(publicApp, /data-exam-count=/);
  assert.match(publicApp, /publicBaselineV081\("total"/);
  assert.match(publicApp, /publicBaselineV081\("subject"/);
  assert.match(publicApp, /publicBaselineV081\("timeline"/);
  assert.match(publicApp, /classList\.add\("share-eink-root"\)/);
  assert.match(index, /app-v094\.css/);
  assert.match(css, /\.public-shell\.eink-share/);
  assert.match(css, /\.eink-share \.public-view-tab/);
  assert.doesNotMatch(css, /(^|\n)\s*(\.trajectory|\.container|\.tabs|\.share-card)\b/);
  assert.doesNotMatch(css, /url\(/);
});

test("the E-ink layer preserves touch and user display preferences", () => {
  assert.match(css, /min-height:\s*44px/);
  assert.doesNotMatch(css, /repeating-linear-gradient/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-contrast: more\)/);
  assert.doesNotMatch(css, /transition:\s*all/);
});
