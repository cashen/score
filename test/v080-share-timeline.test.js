import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publicProjection } from "../src/lib/model.js";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("trajectory sharing exposes full per-exam detail through the existing allow-list", () => {
  const projected = publicProjection(
    { displayName: "小明", graduationYear: 2027, notes: "private" },
    [{
      id: "exam-1",
      name: "月考",
      date: "2026-09-01",
      type: "monthly",
      notes: "do not share",
      overall: { officialScore: 570, rankings: [] },
      subjects: { math: { rawScore: 110, finalScore: null, fullScore: 150, scoreMode: "raw", rankings: [] } }
    }],
    { displayName: true, overallScore: true, overallRank: true, subjectScores: true, subjectRanks: true, history: true }
  );
  assert.equal(projected.exams[0].subjects.math.fullScore, 150);
  assert.equal("notes" in projected.exams[0], false);
  assert.equal(projected.student.notes, undefined);
});

test("shared report has total, subject, timeline and deep exam detail paths", () => {
  assert.match(app, /function renderPublicV080\(/);
  assert.match(app, /function publicSubjectComparisonV080\(/);
  assert.match(app, /function publicTimelineV080\(/);
  assert.match(app, /function publicExamDetailV080\(/);
  assert.match(app, /view=timeline&exam=/);
  assert.match(app, /页面只展示分享白名单中的字段/);
});
