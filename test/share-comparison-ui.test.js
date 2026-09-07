import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/share-comparison.css", import.meta.url), "utf8");
const enhancer = readFileSync(new URL("../public/exam-humanize.js", import.meta.url), "utf8");

test("sharing UI accepts a three-character public slug and names comparison explicitly", () => {
  assert.match(app, /minlength="3"/);
  assert.match(app, /历次考试对比/);
  assert.match(app, /例如 abc/);
});

test("rank participant count is visibly optional in exam entry", () => {
  assert.match(enhancer, /人数可空/);
  assert.match(enhancer, /总人数不知道时直接留空/);
  assert.match(app, /第 \$\{ranking\.rank\} 名/);
  assert.match(app, /总人数未填/);
});

test("shared multi-exam history is rendered as a comparison, not a history dump", () => {
  assert.match(html, /share-comparison\.css/);
  assert.match(app, /function sharedComparisonHtml/);
  assert.match(app, /学校相对位置/);
  assert.match(app, /从较早到最近/);
  assert.match(app, /单科分数轨迹/);
  assert.match(app, /不同考试难度可能不同/);
  assert.match(css, /\.share-position-track/);
  assert.match(css, /\.share-exam-compare-grid/);
  assert.match(css, /@media \(max-width: 520px\)/);
});