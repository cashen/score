import test from "node:test";
import assert from "node:assert/strict";
import { comparableRanking, normalizeExam, normalizeShareFields, percentile, publicProjection } from "../src/lib/model.js";

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

test("rejects impossible ranking", () => {
  const input = baseExam();
  input.overall.rankings = [{ scope: "school", rank: 1400, participants: 1320 }];
  assert.throws(() => normalizeExam(input), /排名不能大于参与人数/);
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
