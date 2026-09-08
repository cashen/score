import test from "node:test";
import assert from "node:assert/strict";
import { comparisonEligibility, comparisonReason, comparableSet } from "../public/trajectory-core-v060.js";

const exam = (id, overrides = {}) => ({
  id,
  type: "monthly",
  comparison: { series: "2026-A", level: "school" },
  ...overrides
});

test("comparison eligibility is explicit for baseline and incompatible metadata", () => {
  assert.equal(comparisonEligibility(exam("a"), null).status, "baseline");
  assert.equal(comparisonEligibility(exam("a"), exam("b", { type: "mock1" })).status, "not_comparable");
  assert.equal(comparisonEligibility(exam("a"), exam("b", { comparison: { series: "2026-B", level: "school" } })).reason, "考试系列不同，暂不直接比较");
  assert.equal(comparisonEligibility(exam("a"), exam("b", { comparison: { series: "2026-A", level: "city" } })).reason, "考试范围不同，暂不直接比较");
});

test("comparable set never falls back to a mismatched series or level", () => {
  const latest = exam("latest");
  const same = exam("same");
  const differentSeries = exam("different-series", { comparison: { series: "2026-B", level: "school" } });
  const differentLevel = exam("different-level", { comparison: { series: "2026-A", level: "city" } });
  assert.deepEqual(comparableSet([latest, differentSeries, differentLevel, same]).map((item) => item.id), ["latest", "same"]);
  assert.equal(comparisonReason(latest, same), "按school口径比较");
});

test("missing metadata remains visible but is marked conditional", () => {
  const result = comparisonEligibility(
    exam("a", { comparison: null }),
    exam("b", { comparison: null })
  );
  assert.equal(result.status, "comparable");
  assert.match(result.reason, /部分比较口径未标注/);
});
