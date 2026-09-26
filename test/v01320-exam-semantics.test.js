import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExam } from "../src/lib/model.js";
import { resolveDisplayMetric } from "../public/human-reading-v140.js";
import { examScoreSummary, scoreConsistency } from "../public/score-core-v090.js";
import { comparisonEligibility, metricBetween } from "../public/record-semantics-v120.js";
import { publicProjection } from "../src/domain/share-projection.js";

test("explicit subjectSet is the persisted exam boundary", () => {
  const exam = normalizeExam({
    name: "英语周测",
    date: "2026-09-25",
    type: "weekly",
    subjectSet: ["english"],
    context: { grade: "高三", classLabel: "3班", schoolLabel: "鞍钢高中" },
    subjects: {
      english: { rawScore: 103 },
      math: { rawScore: 150 }
    }
  });
  assert.deepEqual(Object.keys(exam.subjects), ["english"]);
  assert.equal(exam.overall.calculatedScore, 103);
  assert.equal(exam.subjectSet[0], "english");
  assert.equal(exam.context.classLabel, "3班");
});

test("editing an exam without context preserves its historical context snapshot", () => {
  const existing = normalizeExam({
    name: "高二期中",
    date: "2026-06-20",
    type: "midterm",
    subjectSet: ["chinese", "math", "english"],
    context: { grade: "高二", classLabel: "3班", schoolLabel: "鞍钢高中" },
    subjects: {
      chinese: { rawScore: 120 },
      math: { rawScore: 130 },
      english: { rawScore: 125 }
    }
  });
  const updated = normalizeExam({
    name: "高二期中（补录总分）",
    date: existing.date,
    type: existing.type,
    subjectSet: existing.subjectSet,
    overall: { officialScore: 375 },
    subjects: existing.subjects
  }, existing);
  assert.deepEqual(updated.context, existing.context);
});

test("official total inconsistency is exposed for a complete scoped exam", () => {
  const exam = normalizeExam({
    name: "物化考试",
    date: "2026-09-25",
    type: "school",
    subjectSet: ["physics", "chemistry"],
    overall: { officialScore: 170 },
    subjects: {
      physics: { rawScore: 80 },
      chemistry: { rawScore: 95 }
    }
  });
  assert.equal(exam.overall.scoreConsistency.status, "mismatch");
  assert.equal(exam.overall.scoreConsistency.delta, 5);
  assert.equal(scoreConsistency(exam).status, "mismatch");
});

test("default comparison metric prefers school position over score", () => {
  const exam = {
    subjectSet: ["english"],
    subjects: {
      english: {
        rawScore: 103,
        rankings: [{ scope: "school", label: "学校", rank: 12, participants: 200, basis: "final_score" }]
      }
    }
  };
  assert.equal(resolveDisplayMetric(exam, "english", "auto"), "schoolRank");
});

test("special exam status does not veto a comparable position metric", () => {
  const a = {
    type: "monthly",
    status: "good",
    overall: { rankings: [{ scope: "school", label: "学校", rank: 20, participants: 100, basis: "final_score" }] }
  };
  const b = {
    type: "monthly",
    status: "poor",
    overall: { rankings: [{ scope: "school", label: "学校", rank: 25, participants: 100, basis: "final_score" }] }
  };
  assert.equal(comparisonEligibility(a, b).status, "comparable");
  assert.equal(metricBetween(a, b, null, "schoolRank").kind, "percentile");
});

test("partial scoped exams do not pretend an incomplete subtotal is a complete score", () => {
  const exam = normalizeExam({
    name: "物化考试",
    date: "2026-09-25",
    type: "school",
    subjectSet: ["physics", "chemistry"],
    subjects: { physics: { rawScore: 80 }, chemistry: {} }
  });
  const summary = examScoreSummary(exam);
  assert.equal(summary.kind, "calculated_partial");
  assert.equal(summary.value, null);
});

test("share projection keeps only the exam's real subject scope", () => {
  const student = { displayName: "测试", graduationYear: 2027 };
  const exam = normalizeExam({
    name: "英语周测",
    date: "2026-09-25",
    type: "weekly",
    subjectSet: ["english"],
    subjects: { english: { rawScore: 103 }, physics: { rawScore: 80 } }
  });
  const data = publicProjection(student, [exam], {
    displayName: true, graduationYear: true, school: false, className: false,
    overallScore: true, overallRank: true, subjectScores: true, subjectRanks: true,
    history: true, examStatus: false, comparisonContext: false, status: false, comparison: false
  });
  assert.deepEqual(data.exams[0].subjectSet, ["english"]);
  assert.deepEqual(Object.keys(data.exams[0].subjects), ["english"]);
});


test("ranking identity uses stable population context before label text", async () => {
  const { comparableRanking } = await import("../public/record-semantics-v120.js");
  const base = { scope: "class", label: "3班", labelSnapshot: "3班", contextId: "class:某高中|高三|3班", basis: "final_score", rank: 2 };
  const samePopulationDifferentLabel = { ...base, label: "实验班", labelSnapshot: "实验班", rank: 3 };
  const differentPopulation = { ...base, contextId: "class:某高中|高三|4班", rank: 4 };
  assert.equal(comparableRanking(base, samePopulationDifferentLabel), true);
  assert.equal(comparableRanking(base, differentPopulation), false);
  assert.equal(comparableRanking(
    { scope: "school", label: "学校", basis: "final_score" },
    { scope: "school", label: "学校", basis: "final_score" }
  ), true);
});

test("attendance and special condition are separate facts", () => {
  const special = normalizeExam({
    name: "月考",
    date: "2026-09-25",
    type: "monthly",
    condition: "special",
    subjectSet: ["english"],
    subjects: { english: { rawScore: 103 } }
  });
  const absent = normalizeExam({
    name: "月考",
    date: "2026-09-25",
    type: "monthly",
    attendance: "absent",
    subjectSet: ["english"],
    subjects: { english: {} }
  });
  const legacy = normalizeExam({
    name: "历史月考",
    date: "2026-08-25",
    type: "monthly",
    status: "poor",
    subjectSet: ["english"],
    subjects: { english: { rawScore: 100 } }
  });
  assert.equal(special.attendance, "present");
  assert.equal(special.condition, "special");
  assert.equal(absent.attendance, "absent");
  assert.equal(absent.condition, "normal");
  assert.equal(legacy.condition, "special");
});

test("share projection exposes optional exam situation fields only when allowed", () => {
  const student = { displayName: "测试", graduationYear: 2027 };
  const exam = normalizeExam({
    name: "特殊情况月考",
    date: "2026-09-25",
    type: "monthly",
    attendance: "present",
    condition: "special",
    subjectSet: ["english"],
    subjects: { english: { rawScore: 103 } }
  });
  const data = publicProjection(student, [exam], {
    displayName: true, graduationYear: false, school: false, className: false,
    overallScore: true, overallRank: false, subjectScores: true, subjectRanks: false,
    history: false, examStatus: true, comparisonContext: false, status: false, comparison: false
  });
  assert.equal(data.exams[0].attendance, "present");
  assert.equal(data.exams[0].condition, "special");
});
