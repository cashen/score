import test from "node:test";
import assert from "node:assert/strict";
import { examScoreSummary, examCompleteness, scoreSummaryText } from "../public/score-core-v090.js";
import { normalizeExam, publicProjection } from "../src/lib/model.js";

const make = (subjects = {}, overall = {}, status = "normal") => normalizeExam({ id: crypto.randomUUID(), name: "虚构验收", date: "2026-09-09", type: "monthly", status, subjects, overall });
const subject = score => ({ rawScore: score, fullScore: 150, scoreMode: "raw" });

test("empty and partial scores never masquerade as a total", () => {
  const empty = make();
  assert.equal(empty.overall.calculatedScore, null);
  assert.equal(examScoreSummary(empty).kind, "missing");
  assert.equal(examScoreSummary(empty).value, null);
  const partial = make({ math: subject(90) });
  assert.equal(partial.overall.calculatedScore, 90);
  assert.equal(examScoreSummary(partial).kind, "calculated_partial");
  assert.equal(examScoreSummary(partial).value, null);
  assert.equal(scoreSummaryText(examScoreSummary(partial)), "已录 1/6 科，小计 90 分");
});

test("official zero and complete six-subject totals remain valid", () => {
  const zero = make({}, { officialScore: 0 });
  assert.equal(examScoreSummary(zero).kind, "official");
  assert.equal(examScoreSummary(zero).value, 0);
  const complete = make(Object.fromEntries(["chinese", "math", "english", "physics", "chemistry", "biology"].map(key => [key, subject(10)])));
  assert.equal(examScoreSummary(complete).kind, "calculated_complete");
  assert.equal(examScoreSummary(complete).value, 60);
  assert.equal(examCompleteness(complete).complete, true);
});

test("absence and public projection preserve honest score semantics", () => {
  assert.equal(examScoreSummary(make({}, {}, "absent")).kind, "absent");
  const partial = make({ math: subject(90) });
  const projected = publicProjection({ displayName: "示例" }, [partial], { overallScore: true, subjectScores: true });
  assert.equal(projected.exams[0].overallScore, null);
  assert.equal(projected.exams[0].scoreSummary.kind, "calculated_partial");
  assert.equal(projected.exams[0].scoreSummary.subtotal, 90);
  const reflected = make({ math: subject(90) });
  reflected.reflection = { studentNote: "只给自己看的话", nextTry: "下次先做一道" };
  const shared = publicProjection({ displayName: "示例" }, [reflected], { overallScore: true, subjectScores: true });
  assert.equal("reflection" in shared.exams[0], false);
});
