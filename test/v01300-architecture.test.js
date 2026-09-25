import test from "node:test";
import assert from "node:assert/strict";
import { metricBetween, resolveDisplayMetric, DOMAIN_ARCHITECTURE_VERSION } from "../public/domain-v001.js";

const exam = (score, rank) => ({ status: "normal", subjects: { math: { finalScore: score, rankings: [{ scope: "school", label: "校内", basis: "final_score", rank }] } }, overall: { officialScore: score * 4, rankings: [{ scope: "school", label: "校内", basis: "final_score", rank }] }, comparison: { series: "2027届模考", level: "school" } });

test("v0.13 domain facade is the canonical client semantic boundary", () => {
  assert.equal(DOMAIN_ARCHITECTURE_VERSION, "0.13.1");
  assert.equal(resolveDisplayMetric(exam(120, 3), "math", "auto"), "score");
});

test("auto comparison follows the displayed score instead of silently switching to rank", () => {
  const metric = metricBetween(exam(120, 3), exam(118, 2), "math", "auto");
  assert.equal(metric.kind, "score");
  assert.equal(metric.delta, 2);
});

test("explicit ranking comparison remains available", () => {
  const metric = metricBetween(exam(120, 3), exam(118, 2), "math", "schoolRank");
  assert.equal(metric.kind, "school-rank");
  assert.equal(metric.delta, -1);
});