import test from "node:test";
import assert from "node:assert/strict";
import { trajectoryAnalysis, chooseTrajectoryMetric, changeDrivers, subjectObservationExams } from "../public/trajectory-analysis-v010.js";

const exam = (id, date, series = "月考", schoolRank = null, participants = 100, score = null) => ({
  id, name: id, date, type: "monthly", status: "normal",
  comparison: { series, level: "school" },
  overall: { officialScore: score, rankings: schoolRank == null ? [] : [{ scope: "school", rank: schoolRank, participants, basis: "final_score" }] },
  subjects: {}
});

function withMath(e, rank, participants = 100, score = null) {
  return { ...e, subjects: { math: { rawScore: score, finalScore: null, rankings: rank == null ? [] : [{ scope: "school", rank, participants, basis: "final_score" }] } } };
}

test("multi-exam trajectory keeps baseline, recent window and stability separate", () => {
  const exams = [
    withMath(exam("e1", "2026-03-01"), 18, 100, 105),
    withMath(exam("e2", "2026-04-01"), 19, 100, 112),
    withMath(exam("e3", "2026-05-01"), 16, 100, 118),
    withMath(exam("e4", "2026-06-01"), 15, 100, 120),
    withMath(exam("e5", "2026-07-01"), 13, 100, 122)
  ];
  const result = trajectoryAnalysis(exams, "math");
  assert.equal(result.metric, "score");
  assert.equal(result.comparableCount, 5);
  assert.equal(result.baseline.display, "105 分");
  assert.equal(result.current.display, "122 分");
  assert.equal(result.longDirection, "forward");
  assert.equal(result.stability.label, "比较稳定");
});

test("auto metric follows the displayed score when score data is present", () => {
  const exams = [
    withMath(exam("e1", "2026-03-01"), 20),
    withMath(exam("e2", "2026-04-01"), 18),
    withMath(exam("e3", "2026-05-01"), 17, 100, null)
  ];
  assert.equal(chooseTrajectoryMetric(exams, "math"), "score");
});

test("one exam is a baseline and must not manufacture a trend", () => {
  const result = trajectoryAnalysis([withMath(exam("e1", "2026-03-01"), 20)], "math");
  assert.equal(result.comparableCount, 1);
  assert.equal(result.direction, "insufficient");
  assert.equal(result.longDirection, "steady");
  assert.equal(result.previous, null);
});

test("non-comparable exams are excluded from the trajectory without becoming a false decline", () => {
  const exams = [
    withMath(exam("e1", "2026-03-01", "月考"), 20),
    withMath(exam("e2", "2026-04-01", "联考"), 10),
    withMath(exam("e3", "2026-05-01", "月考"), 18)
  ];
  const result = trajectoryAnalysis(exams, "math");
  assert.equal(result.comparableCount, 2);
  assert.equal(result.direction, "forward");
  assert.equal(result.skipped.length, 1);
});

test("change drivers identify subject movement from the same semantic metric", () => {
  const exams = [
    withMath(exam("e1", "2026-03-01"), 30),
    withMath(exam("e2", "2026-04-01"), 20),
    withMath(exam("e3", "2026-05-01"), 15)
  ];
  const drivers = changeDrivers(exams);
  assert.equal(drivers[0].key, "math");
  assert.equal(drivers[0].analysis.longDirection, "forward");
});


test("single-subject trajectory ignores exams without that subject, including the latest exam", () => {
  const exams = [
    withMath(exam("e1", "2026-03-01"), 30, 100, 105),
    exam("e2", "2026-04-01"),
    withMath(exam("e3", "2026-05-01"), 18, 100, 118)
  ];
  const observed = subjectObservationExams(exams, "math");
  assert.deepEqual(observed.map((item) => item.id), ["e3", "e1"]);
  const result = trajectoryAnalysis(exams, "math");
  assert.equal(result.comparableCount, 2);
  assert.equal(result.current.examId, "e3");
  assert.equal(result.previous.examId, "e1");
  assert.equal(result.skipped.length, 0);
});