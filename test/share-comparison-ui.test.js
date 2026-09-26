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
  assert.match(app, /publicHistory\(exams, result\.share\)/);
  assert.match(app, /publicOverallHistoryCoordinate/);
  assert.doesNotMatch(index, /share-comparison\.css/);
  assert.doesNotMatch(index, /share-timeline-v2\.js/);
});

test("shared report keeps identity above equal-weight coordinates", () => {
  assert.match(app, /coordinate-row/);
  assert.match(css, /\.public-coordinate h1[\s\S]*font-size:\s*31px/);
  assert.match(css, /\.coordinate-row > span[\s\S]*font-size:\s*24px/);
});

test("history states stay factual rather than gamified", () => {
  assert.match(app, /历次考试/);
  assert.match(app, /每一场只显示这场考试自己分享的成绩和排名/);
  assert.doesNotMatch(app, /排行榜/);
  assert.match(app, /联考第/);
  assert.match(app, /考试情况/);
  assert.match(app, /比较范围/);
});
