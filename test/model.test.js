import test from "node:test";
import assert from "node:assert/strict";
import { comparableRanking, normalizeExam, normalizePublicSlug, normalizeShareFields, percentile, publicProjection } from "../src/lib/model.js";

function baseExam() {
  return {
    name: "9月联考",
    date: "2026-09-05",
    type: "joint",
    overall: {
      officialScore: 598,
      rankings: [
        { scope: "school", label: "学校", rank: 128, participants: 1320 },
        { scope: "class", label: "03班", rank: 9, participants: 52 }
      ]
    },
    subjects: {
      math: { scoreMode: "raw", fullScore: 150, rawScore: 126, finalScore: 126, rankings: [{ scope: "school", rank: 102, participants: 1320 }] },
      chemistry: { scoreMode: "raw_and_converted", fullScore: 100, rawScore: 71, finalScore: 76 }
    },
    notes: "只应该家庭内部可见"
  };
}

test("normalizes an exam and preserves raw/final score modes", () => {
  const exam = normalizeExam(baseExam());
  assert.equal(exam.overall.officialScore, 598);
  assert.equal(exam.subjects.math.rawScore, 126);
  assert.equal(exam.subjects.chemistry.finalScore, 76);
  assert.equal(exam.subjects.chemistry.scoreMode, "raw_and_converted");
  assert.equal(exam.revision, 1);
});

test("allows a useful rank when participant count is unknown", () => {
  const input = baseExam();
  input.overall.rankings = [{ scope: "school", label: "学校", rank: 127, participants: null }];
  input.subjects.math.rankings = [{ scope: "class", label: "03班", rank: 6 }];
  const exam = normalizeExam(input);
  assert.equal(exam.overall.rankings[0].rank, 127);
  assert.equal(exam.overall.rankings[0].participants, null);
  assert.equal(exam.subjects.math.rankings[0].rank, 6);
  assert.equal(exam.subjects.math.rankings[0].participants, null);
  assert.equal(percentile(127, null), null);
});

test("rejects impossible ranking when both rank and participant count are known", () => {
  const input = baseExam();
  input.overall.rankings = [{ scope: "school", rank: 1400, participants: 1320 }];
  assert.throws(() => normalizeExam(input), /排名不能大于参与人数/);
});

test("accepts short human public slugs and normalizes case", () => {
  assert.equal(normalizePublicSlug("ABC"), "abc");
  assert.equal(normalizePublicSlug("a-b"), "a-b");
  assert.equal(normalizePublicSlug("Family-2027"), "family-2027");
  assert.throws(() => normalizePublicSlug("ab"), /3–50/);
  assert.throws(() => normalizePublicSlug("-abc"), /短横线/);
  assert.throws(() => normalizePublicSlug("abc-"), /短横线/);
});

test("public projection is allow-listed and never leaks notes", () => {
  const exam = normalizeExam(baseExam());
  const student = { displayName: "小王", graduationYear: 2027, schoolLabel: "某高中", className: "03班" };
  const fields = normalizeShareFields({ school: false, className: false, subjectScores: true, subjectRanks: true });
  const projection = publicProjection(student, [exam], fields);
  assert.equal(projection.student.displayName, "小王");
  assert.equal(projection.student.schoolLabel, null);
  assert.equal(projection.student.className, null);
  assert.equal(projection.exams[0].subjects.math.finalScore, 126);
  assert.equal("notes" in projection.exams[0], false);
});

test("percentile and comparison require coherent ranking scope", () => {
  assert.equal(percentile(120, 1200), 10);
  assert.equal(percentile(0, 1200), null);
  assert.equal(comparableRanking({ scope: "school", label: "物理类", basis: "final_score" }, { scope: "school", label: "物理类", basis: "final_score" }), true);
  assert.equal(comparableRanking({ scope: "school", label: "物理类", basis: "final_score" }, { scope: "school", label: "物化生", basis: "final_score" }), false);
});

test("optional comparison metadata is normalized without breaking schema-v1 exams", () => {
  const input = baseExam();
  input.comparison = { series: " 2027届辽宁模考 ", level: "province" };
  const exam = normalizeExam(input);
  assert.equal(exam.schemaVersion, 1);
  assert.deepEqual(exam.comparison, { series: "2027届辽宁模考", level: "province" });

  const legacy = normalizeExam(baseExam());
  assert.equal(legacy.comparison, null);
});

test("legacy edit requests preserve existing comparison metadata when the field is absent", () => {
  const originalInput = baseExam();
  originalInput.comparison = { series: "高三校内月考", level: "school" };
  const original = normalizeExam(originalInput);
  const edit = baseExam();
  edit.name = "9月联考（补录排名）";
  delete edit.comparison;
  const updated = normalizeExam(edit, original);
  assert.deepEqual(updated.comparison, original.comparison);
  assert.equal(updated.revision, 2);
});

test("comparison metadata can be deliberately cleared and is safe in public projection", () => {
  const input = baseExam();
  input.comparison = { series: "2027届辽宁模考", level: "province" };
  const exam = normalizeExam(input);
  const student = { displayName: "小王", graduationYear: 2027 };
  const projection = publicProjection(student, [exam], normalizeShareFields({ school: false, className: false }));
  assert.deepEqual(projection.exams[0].comparison, { series: "2027届辽宁模考", level: "province" });
  assert.equal("notes" in projection.exams[0], false);

  const clearedInput = baseExam();
  clearedInput.comparison = {};
  const cleared = normalizeExam(clearedInput, exam);
  assert.equal(cleared.comparison, null);
});
