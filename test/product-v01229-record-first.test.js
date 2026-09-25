import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/css/app-v094.css", import.meta.url), "utf8");

test("record-first reading imports the centralized score delta layer", () => {
  assert.match(app, /from "\.\/domain-v001\.js"/);
  assert.match(app, /function previousComparableExam\(exams, current\)/);
  assert.match(app, /metricBetween\(exam, previous, key, "score"\)/);
  assert.match(app, /shouldShowScoreDelta\(scoreMetric\)/);
});

test("private reading views expose score changes without changing ranking semantics", () => {
  assert.match(app, /function renderSubjectRows\(exam, previous = null\)/);
  assert.match(app, /class="score-change-inline"/);
  assert.match(app, /function renderExamList\(\)/);
  assert.match(app, /function renderExamDetail\(exam\)/);
  assert.match(app, /function renderTimelineView\(\)/);
  assert.match(app, /function renderDeepTrajectory\(\)/);
});

test("public reading only derives score changes from explicitly shared score fields", () => {
  assert.match(app, /share\.fields\?\.subjectScores === true/);
  assert.match(app, /share\.fields\?\.overallScore === true/);
  assert.match(app, /function publicSubjectRows\(exam, share = \{\}, exams = \[\]\)/);
  assert.match(app, /function publicExamDetailV080\(exam, share = \{\}, exams = \[\]\)/);
  assert.match(app, /function publicTimelineV080\(exams, selectedExamId = null, share = \{\}\)/);
});

test("the restrained change treatment does not introduce direction colors", () => {
  assert.match(css, /\.score-change \{/);
  assert.doesNotMatch(css, /\.score-change-(up|down).*color:/s);
});