import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("external sharing is rendered as a calm report from the source renderer", () => {
  assert.match(app, /function renderExternal\(/);
  assert.match(app, /public-coordinate/);
  assert.match(app, /publicSubjectRows/);
  assert.match(app, /publicHistory/);
  assert.doesNotMatch(index, /share-comparison\.css/);
  assert.doesNotMatch(index, /share-timeline-v2\.js/);
});

test("shared report keeps identity above equal-weight coordinates", () => {
  assert.match(app, /coordinate-row/);
  assert.match(css, /\.public-coordinate h1[\s\S]*font-size:\s*31px/);
  assert.match(css, /\.coordinate-row > span[\s\S]*font-size:\s*24px/);
});

test("history states stay factual rather than gamified", () => {
  assert.match(app, /历次轨迹/);
  assert.match(app, /不同考试难度可能不同，优先看相对位置；分数只作辅助/);
  assert.doesNotMatch(app, /排行榜/);
});
