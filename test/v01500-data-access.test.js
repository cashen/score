import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("v0.15 canonical exam reads no longer enumerate summary keys", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.ok(source.includes("getManyJson(env, keys)"));
  assert.ok(source.includes("exam-index:${studentId}"));
  assert.ok(source.includes("exam-trash-index:${studentId}"));
  const readStart = source.indexOf("async function loadExams");
  const readEnd = source.indexOf("async function loadTrashExams", readStart);
  assert.ok(readStart >= 0 && readEnd > readStart);
  assert.doesNotMatch(source.slice(readStart, readEnd), /listKeys/);
});

test("v0.15 production binds the serialized student index writer", async () => {
  const wrangler = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
  const entry = await readFile(new URL("../src/v020.js", import.meta.url), "utf8");
  assert.ok(wrangler.includes('name = "STUDENT_INDEX"\nclass_name = "StudentIndexCoordinator"'));
  assert.ok(wrangler.includes('tag = "v2"\nnew_sqlite_classes = ["StudentIndexCoordinator"]'));
  assert.ok(entry.includes('export { StudentIndexCoordinator } from "./student-index-coordinator.js";'));
});

test("v0.15 active index writes stop duplicating per-exam summary keys", async () => {
  const source = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /putJson\(env,.*exam-summary:/);
  assert.ok(source.includes('mutateExamIndexes(env, studentId, "upsert-active", examSummary(exam))'));
});

test("v0.15 save flow adopts the server response and keeps the editor open", async () => {
  const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const start = source.indexOf("async function saveExam(event)");
  const end = source.indexOf("async function deleteExam()", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.ok(block.includes("const savedExam = savedResult?.exam;"));
  assert.doesNotMatch(block, /await loadStudentData\\(\\)/);
  assert.doesNotMatch(block, /closeDialog\\(\\)/);
  assert.ok(block.includes("已保存。可以继续修改"));
});

test("v0.15 public share has an independent browser entry", async () => {
  const routerSource = await readFile(new URL("../public/router-v2.js", import.meta.url), "utf8");
  const share = await readFile(new URL("../public/share-app.js", import.meta.url), "utf8");
  const privateApp = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(routerSource.includes('else if (externalShare) await import("./share-app.js")'));
  assert.ok(share.includes("bootstrapShare();"));
  assert.doesNotMatch(privateApp, /function renderPublicV080/);
  assert.doesNotMatch(privateApp, /function renderExternal/);
});
