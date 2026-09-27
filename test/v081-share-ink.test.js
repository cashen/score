import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/css/share-eink-v001.css", import.meta.url), "utf8");

test("single-exam public views explain the current baseline without inventing a trend", () => {
  assert.match(app, /function publicBaselineV081\(view, exams, share = \{\}\)\s*\{/);
  assert.match(app, /exams\.length !== 1/);
  assert.match(app, /目前的记录/);
  assert.match(app, /现在只记录到这一场考试/);
  assert.doesNotMatch(app, /目前的记录[^]*?(预测|能力判断|必然进步)/);
});

test("the E-ink treatment is scoped to external share rendering", () => {
  assert.match(app, /class="public-shell eink-share"/);
  assert.match(app, /data-share-view=/);
  assert.match(app, /data-exam-count=/);
  assert.match(app, /publicBaselineV081\("total"/);
  assert.match(app, /publicBaselineV081\("subject"/);
  assert.match(app, /publicBaselineV081\("timeline"/);
  assert.match(app, /classList\.add\("share-eink-root"\)/);
  assert.match(index, /app-v094\.css/);
  assert.match(css, /\.public-shell\.ink-share/);
  assert.match(css, /\.ink-share \.public-view-tab/);
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
