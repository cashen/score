import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const shareApp = await readFile(new URL("../public/share-app.js", import.meta.url), "utf8");
const publicApp = app + "\n" + shareApp;
const index = await readFile(new URL("../src/index.js", import.meta.url), "utf8");
const sharing = await readFile(new URL("../src/sharing-v2.js", import.meta.url), "utf8");
const model = await readFile(new URL("../src/lib/model.js", import.meta.url), "utf8");

test("subject is a focus, not a destructive filter", () => {
  assert.match(publicApp, /全部科目/);
  assert.match(publicApp, /data-subject-key=""/);
  assert.match(publicApp, /const subject = validSubjectKey\(params\.get\("subject"\)\)/);
  assert.doesNotMatch(app, /params\.get\("subject"\)\) \? params\.get\("subject"\) : "chinese"/);
  assert.ok(app.includes('["考试信息", "本次成绩", "位置与补充"]'));
  assert.match(publicApp, /考试当时的信息/);
  assert.match(publicApp, /data-action='undo-delete'/);
});

test("private navigation state is URL-restorable", () => {
  assert.match(publicApp, /function syncPrivateNavigationFromUrl\(/);
  assert.match(publicApp, /function writePrivateNavigation\(/);
  assert.match(publicApp, /dispatchViewAction\(state, \{\s*type: "view\/tab"/);
  assert.match(publicApp, /type: "view\/overview"[\s\S]*examId:/);
});

test("editing preserves context and detail comparisons follow chronological direction", () => {
  assert.match(publicApp, /captureViewContext\(state\)/);
  assert.match(publicApp, /restoreViewContext\(state/);
  assert.match(publicApp, /coreFindComparableExam\(state\.exams, exam\)/);
  assert.doesNotMatch(app, /state\.tab = wasNew \? "overview" : "exams"/);
});

test("change copy and source rows use the actual metric", () => {
  assert.match(publicApp, /这次分数比上一次高/);
  assert.match(publicApp, /change-source-row/);
  assert.match(publicApp, /metric\.detail/);
  assert.doesNotMatch(app, /以学校排名为依据|以班级排名为依据/);
});

test("editing an existing status preserves its exact semantic value", () => {
  assert.match(publicApp, /good: "状态良好"/);
  assert.match(publicApp, /partial: "数据未齐"/);
  assert.match(publicApp, /\(exam\?\.status \|\| "normal"\) === value/);
});

test("share v2 is the runtime contract and legacy grants are normalized", () => {
  assert.match(index, /routePrivateSharingV2, routePublicSharingV2/);
  assert.doesNotMatch(index, /function handleShareCreate/);
  assert.doesNotMatch(index, /function handleExternalShare/);
  assert.match(sharing, /const scope = grant\.scope === "trajectory" \? "trajectory" : "single"/);
});

test("share fields are strict booleans and final score respects full score", () => {
  assert.match(model, /typeof input\[key\] === "boolean"/);
  assert.match(model, /finalScore != null && finalScore > fullScore/);
});