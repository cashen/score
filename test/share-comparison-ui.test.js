import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const shareApp = await readFile(new URL("../public/share-app.js", import.meta.url), "utf8");
const publicApp = app + "\n" + shareApp;
const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("external sharing is rendered as a calm report from the source renderer", () => {
  assert.match(publicApp, /function renderExternal\(/);
  assert.match(publicApp, /public-coordinate/);
  assert.match(publicApp, /publicSubjectRows/);
  assert.match(publicApp, /publicHistory\(exams, result\.share\)/);
  assert.match(publicApp, /publicOverallHistoryCoordinate/);
  assert.doesNotMatch(index, /share-comparison\.css/);
  assert.doesNotMatch(index, /share-timeline-v2\.js/);
});

test("shared report keeps identity above equal-weight coordinates", () => {
  assert.match(publicApp, /coordinate-row/);
  assert.match(css, /\.public-coordinate h1[\s\S]*font-size:\s*31px/);
  assert.match(css, /\.coordinate-row > span[\s\S]*font-size:\s*24px/);
});

test("history states stay factual rather than gamified", () => {
  assert.match(publicApp, /历次考试/);
  assert.match(publicApp, /每一场只显示这场考试自己分享的成绩和排名/);
  assert.doesNotMatch(app, /排行榜/);
  assert.match(publicApp, /联考第/);
  assert.match(publicApp, /考试情况/);
  assert.match(publicApp, /比较范围/);
});
