import test from "node:test";
import assert from "node:assert/strict";
import { comparableExamCategory, examComparisonCategory, normalizeExam } from "../src/lib/model.js";

test("monthly stays separate while joint and school share a category", () => {
  assert.equal(examComparisonCategory("monthly"), "monthly");
  assert.equal(examComparisonCategory("joint"), "joint_school");
  assert.equal(examComparisonCategory("school"), "joint_school");
  assert.equal(comparableExamCategory("joint", "school"), true);
  assert.equal(comparableExamCategory("monthly", "joint"), false);
  assert.equal(comparableExamCategory("monthly", "school"), false);
});

test("mock stages share one category and unrelated exam types stay separate", () => {
  assert.equal(comparableExamCategory("mock1", "mock2"), true);
  assert.equal(comparableExamCategory("mock2", "mock3"), true);
  assert.equal(comparableExamCategory("weekly", "monthly"), false);
  assert.equal(comparableExamCategory("midterm", "final"), false);
});

test("school exam and joint rank are accepted without joint participant count", () => {
  const school = normalizeExam({ name: "校考", date: "2026-10-01", type: "school", overall: { officialScore: 580 }, subjects: {} });
  assert.equal(school.type, "school");
  const joint = normalizeExam({
    name: "联考",
    date: "2026-10-12",
    type: "joint",
    overall: { officialScore: 590, rankings: [{ scope: "joint", label: "联考", rank: 326, participants: null }] },
    subjects: {}
  });
  assert.equal(joint.overall.rankings[0].scope, "joint");
  assert.equal(joint.overall.rankings[0].rank, 326);
  assert.equal(joint.overall.rankings[0].participants, null);
});
