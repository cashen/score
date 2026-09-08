import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("trajectory has parallel total, subject and timeline views", () => {
  assert.match(app, /data-trajectory-view=/);
  assert.match(app, /总成绩/);
  assert.match(app, /单科对比/);
  assert.match(app, /时间轴/);
  assert.match(app, /function renderSubjectComparison\(/);
  assert.match(app, /function renderTimelineView\(/);
});

test("one exam is treated as a baseline without a trend claim", () => {
  assert.match(app, /status: "baseline"/);
  assert.match(app, /还没有第二次可比考试/);
  assert.match(app, /还没有考试记录/);
});

test("timeline exposes every loaded exam through a native detail link", () => {
  assert.match(app, /state\.exams\.map/);
  assert.match(app, /view=timeline&exam=/);
  assert.match(app, /function renderExamDetail\(/);
  assert.match(app, /exam-detail-subject/);
});

test("subject view keeps score and ranks as separate metrics", () => {
  assert.match(app, /data-subject-metric="score"/);
  assert.match(app, /data-subject-metric="schoolRank"/);
  assert.match(app, /data-subject-metric="classRank"/);
  assert.match(app, /把分数、学校排名和班级排名分开看/);
});
