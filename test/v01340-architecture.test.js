import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeExam } from "../src/lib/model.js";
import { examScoreSummary } from "../src/domain/score.js";
import { resolveExamScope } from "../src/domain/exam.js";
import { comparisonEligibility } from "../src/domain/comparison.js";
import { PUBLIC_VIEW_LABELS, PUBLIC_SUBJECT_OVERVIEW_LABEL } from "../public/product-contract.js";

test("server model no longer depends on frontend public modules", async () => {
  const model = await readFile(new URL("../src/lib/model.js", import.meta.url), "utf8");
  assert.doesNotMatch(model, /\.\.\/\.\.\/public\//);
});

test("canonical server domains preserve scoped exam semantics", () => {
  const exam = normalizeExam({ name:"英语月考", date:"2026-09-26", type:"monthly", subjectSet:["english"], subjects:{english:{rawScore:103}} });
  assert.deepEqual(resolveExamScope(exam).subjects, ["english"]);
  assert.equal(examScoreSummary(exam).label, "英语");
  assert.equal(comparisonEligibility(exam, { ...exam }).status, "comparable");
});

test("public reading labels have one explicit contract", () => {
  assert.deepEqual(PUBLIC_VIEW_LABELS, { total:"这次成绩", subject:"单科", timeline:"历次考试" });
  assert.equal(PUBLIC_SUBJECT_OVERVIEW_LABEL, "科目概览");
});
