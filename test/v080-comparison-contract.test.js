import test from "node:test";
import assert from "node:assert/strict";
import { comparisonEligibility, comparisonReason, comparableSet, findComparableExam } from "../public/trajectory-core-v060.js";

const exam = (id, overrides = {}) => ({
  id,
  type: "monthly",
  comparison: { series: "2026-A", level: "school" },
  ...overrides
});

test("comparison search can pass an incompatible immediate predecessor", () => {
  const latest = exam("latest");
  const result = findComparableExam([latest, exam("wrong", { type: "weekly" }), exam("older")]);
  assert.equal(result.reference.id, "older");
});

test("comparison eligibility is explicit for baseline and incompatible metadata", () => {
  assert.equal(comparisonEligibility(exam("a"), null).status, "baseline");
  assert.equal(comparisonEligibility(exam("a"), exam("b", { type: "mock1" })).status, "not_comparable");
  assert.equal(comparisonEligibility(exam("a"), exam("b", { comparison: { series: "2026-B", level: "school" } })).reason, "考试系列不同，暂不直接比较");
  assert.equal(comparisonEligibility(exam("a"), exam("b", { comparison: { series: "2026-A", level: "city" } })).reason, "考试范围不同，暂不直接比较");
});

test("comparable set never falls back to a mismatched series or level", () => {
  const latest = exam("latest", { date: "2026-09-18", createdAt: "2026-09-18T08:00:00.000Z" });
  const same = exam("same", { date: "2026-09-17", createdAt: "2026-09-17T08:00:00.000Z" });
  const differentSeries = exam("different-series", { date: "2026-09-16", createdAt: "2026-09-16T08:00:00.000Z", comparison: { series: "2026-B", level: "school" } });
  const differentLevel = exam("different-level", { date: "2026-09-15", createdAt: "2026-09-15T08:00:00.000Z", comparison: { series: "2026-A", level: "city" } });
  assert.deepEqual(comparableSet([latest, differentSeries, differentLevel, same]).map((item) => item.id), ["latest", "same"]);
  assert.equal(comparisonReason(latest, same), "按school范围比较");
});

test("missing metadata remains visible but is marked conditional", () => {
  const result = comparisonEligibility(
    exam("a", { comparison: null }),
    exam("b", { comparison: null })
  );
  assert.equal(result.status, "comparable");
  assert.match(result.reason, /考试类别相同，但比较范围信息不完整/);
});
