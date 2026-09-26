import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeExam } from "../src/lib/model.js";
import { comparisonStrengthLabel, comparisonEligibility, comparableRanking } from "../public/record-semantics-v120.js";

test("v0.13.3 comparison strength is human-readable and neutral", () => {
  assert.equal(comparisonStrengthLabel({ status: "comparable", strength: "strong" }), "同系列直接对比");
  assert.equal(comparisonStrengthLabel({ status: "comparable", strength: "limited" }), "参考对比（条件不完全一致）");
  assert.equal(comparisonStrengthLabel({ status: "comparable", strength: "standard" }), "同类考试对比");
  assert.equal(comparisonStrengthLabel({ status: "baseline" }), "还没有可以比较的历史");
});

test("context-aware ranking comparison is not changed by class rename", () => {
  assert.equal(comparableRanking(
    { scope: "class", label: "3班", labelSnapshot: "3班", contextId: "class:学校|高三|3班", basis: "final_score" },
    { scope: "class", label: "实验班", labelSnapshot: "实验班", contextId: "class:学校|高三|3班", basis: "final_score" }
  ), true);
  assert.equal(comparableRanking(
    { scope: "class", label: "3班", labelSnapshot: "3班", contextId: "class:学校|高三|3班", basis: "final_score" },
    { scope: "class", label: "3班", labelSnapshot: "3班", contextId: "class:学校|高三|4班", basis: "final_score" }
  ), false);
});

test("exam normalization carries separate attendance and condition facts", () => {
  const exam = normalizeExam({
    name: "英语月考",
    date: "2026-09-26",
    type: "monthly",
    attendance: "present",
    condition: "special",
    subjectSet: ["english"],
    subjects: { english: { rawScore: 101 } }
  });
  assert.equal(exam.attendance, "present");
  assert.equal(exam.condition, "special");
  assert.equal(comparisonEligibility(exam, { ...exam, condition: "normal" }).status, "comparable");
});

test("source contract contains the human-efficiency entry and share defaults", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(app.includes('["考试信息", "本次成绩", "位置与补充"]'));
  assert.match(app, /data-action='undo-delete'/);
  assert.match(app, /固定当前内容/);
  assert.match(app, /各科成绩/);
  assert.doesNotMatch(app, /全部六科/);
});
