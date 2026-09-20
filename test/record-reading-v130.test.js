import test from "node:test";
import assert from "node:assert/strict";
import { scoreDeltaParts, shouldShowScoreDelta, scoreChangeSentence, scoreChangeDetail } from "../public/record-reading-v130.js";

test("score delta is expressed as a compact human-readable change", () => {
  const metric = { kind: "score", delta: 8, previousValue: 604, currentValue: 612 };
  assert.deepEqual(scoreDeltaParts(metric), { delta: 8, amount: "8", compact: "+8 分", direction: "up" });
  assert.equal(shouldShowScoreDelta(metric), true);
  assert.equal(scoreChangeSentence(metric), "比上一场高 8 分");
  assert.equal(scoreChangeDetail(metric), "604 → 612 分");
});

test("negative score delta uses factual low wording", () => {
  const metric = { kind: "score", delta: -3.5, previousValue: 121, currentValue: 117.5 };
  assert.equal(scoreDeltaParts(metric).compact, "−3.5 分");
  assert.equal(scoreChangeSentence(metric), "比上一场低 3.5 分");
  assert.equal(scoreChangeDetail(metric), "121 → 117.5 分");
});

test("small score movement is omitted from the visible delta", () => {
  const metric = { kind: "score", delta: 0.9, previousValue: 120, currentValue: 120.9 };
  assert.equal(shouldShowScoreDelta(metric), false);
});

test("ranking and percentile metrics are never rendered as score deltas", () => {
  for (const metric of [
    { kind: "school-rank", delta: 8, currentValue: 12, previousValue: 20 },
    { kind: "percentile", delta: 2, currentValue: 8, previousValue: 10 },
    null
  ]) {
    assert.equal(scoreDeltaParts(metric), null);
    assert.equal(shouldShowScoreDelta(metric), false);
    assert.equal(scoreChangeSentence(metric), "");
    assert.equal(scoreChangeDetail(metric), "");
  }
});
