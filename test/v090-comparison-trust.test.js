import test from "node:test";
import assert from "node:assert/strict";
import { comparisonEligibility, findComparableExam } from "../public/trajectory-core-v060.js";

const exam = (id, overrides = {}) => ({ id, type: "monthly", status: "normal", comparison: { series: "A", level: "school" }, ...overrides });

test("the nearest truly comparable exam is found beyond incompatible history", () => {
  const latest = exam("latest");
  const incompatible = exam("middle", { comparison: { series: "B", level: "school" } });
  const older = exam("older");
  const result = findComparableExam([latest, incompatible, older]);
  assert.equal(result.reference.id, "older");
  assert.deepEqual(result.skipped.map(item => item.id), ["middle"]);
});

test("absent and special exams stay visible but never enter automatic comparison", () => {
  assert.equal(comparisonEligibility(exam("a", { status: "absent" }), exam("b")).status, "not_comparable");
  assert.equal(comparisonEligibility(exam("a"), exam("b", { status: "poor" })).status, "not_comparable");
  const result = findComparableExam([exam("latest"), exam("special", { status: "partial" }), exam("older")]);
  assert.equal(result.reference.id, "older");
});

test("missing a comparable reference reports history without claiming no exams exist", () => {
  const result = findComparableExam([exam("latest"), exam("other", { type: "weekly" })]);
  assert.equal(result.reference, null);
  assert.match(result.reason, /之前有 1 场考试/);
});
