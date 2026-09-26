import test from "node:test";
import assert from "node:assert/strict";
import { comparisonEligibility, findComparableExam } from "../public/trajectory-core-v060.js";

const exam = (id, overrides = {}) => ({
  id,
  date: ({ latest: "2026-09-03", special: "2026-09-02", middle: "2026-09-02", older: "2026-09-01", other: "2026-08-01" }[id] || "2026-08-01"),
  type: "monthly",
  status: "normal",
  comparison: { series: "A", level: "school" },
  ...overrides
});

test("the nearest same-category exam can be used even when series metadata differs", () => {
  const latest = exam("latest");
  const incompatible = exam("middle", { comparison: { series: "B", level: "school" } });
  const older = exam("older");
  const result = findComparableExam([latest, incompatible, older]);
  assert.equal(result.reference.id, "middle");
  assert.deepEqual(result.skipped.map(item => item.id), []);
});

test("absent exams stay visible but special-status exams remain comparable when data permits", () => {
  assert.equal(comparisonEligibility(exam("a", { status: "absent" }), exam("b")).status, "not_comparable");
  assert.equal(comparisonEligibility(exam("a"), exam("b", { status: "poor" })).status, "comparable");
  const result = findComparableExam([exam("latest"), exam("special", { status: "partial" }), exam("older")]);
  assert.equal(result.reference.id, "special");
});

test("missing a comparable reference reports history without claiming no exams exist", () => {
  const result = findComparableExam([exam("latest"), exam("other", { type: "weekly" })]);
  assert.equal(result.reference, null);
  assert.match(result.reason, /之前有 1 场考试/);
});
