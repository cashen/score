import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("comparison metadata stays optional and out of the primary exam path", () => {
  assert.match(app, /更多考试信息（可选）/);
  assert.match(app, /考试范围/);
  assert.match(app, /属于同一个考试系列/);
  assert.match(app, /comparison:\s*\{ series:/);
});

test("comparison copy avoids causal claims", () => {
  assert.match(app, /变化较明显的科目/);
  assert.doesNotMatch(app, /变化来自哪里/);
  assert.match(app, /先看事实，再决定要不要介入/);
});

test("overall comparison prefers relative position before score", () => {
  const metric = app.slice(app.indexOf("function metricBetween"), app.indexOf("function directionText"));
  assert.ok(metric.indexOf("percentile") < metric.indexOf("school-rank"));
  assert.ok(metric.indexOf("school-rank") < metric.indexOf("class-rank"));
  assert.ok(metric.indexOf("class-rank") < metric.lastIndexOf("score"));
});
