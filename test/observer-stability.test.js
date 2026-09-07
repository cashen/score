import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const exam = await readFile(new URL("../public/exam-humanize.js", import.meta.url), "utf8");
const draft = await readFile(new URL("../public/draft.js", import.meta.url), "utf8");
const family = await readFile(new URL("../public/family-management.js", import.meta.url), "utf8");
const shareCopy = await readFile(new URL("../public/share-copy.js", import.meta.url), "utf8");
const trajectory = await readFile(new URL("../public/trajectory-v2.js", import.meta.url), "utf8");
const onboarding = await readFile(new URL("../public/onboarding-v2.js", import.meta.url), "utf8");

for (const [name, source] of [["exam", exam], ["draft", draft], ["family", family], ["share-copy", shareCopy], ["trajectory", trajectory], ["onboarding", onboarding]]) {
  test(`${name} enhancement never observes the whole document subtree`, () => {
    assert.doesNotMatch(source, /observe\(document\.documentElement\s*,\s*\{[^}]*subtree\s*:\s*true/s);
    assert.doesNotMatch(source, /observe\([^,]+,\s*\{[^}]*subtree\s*:\s*true/s);
  });
}

test("exam and draft lifecycle only watch direct body children", () => {
  assert.match(exam, /observe\(document\.body,\s*\{\s*childList:\s*true\s*\}\)/);
  assert.match(draft, /observe\(document\.body,\s*\{\s*childList:\s*true\s*\}\)/);
});

test("draft restore is explicit and does not depend on repeated DOM text scanning", () => {
  assert.match(draft, /score:draft-restored/);
  assert.match(draft, /dataset\.draftRestored\s*=\s*"1"/);
  assert.doesNotMatch(exam, /includes\("已恢复本机未同步草稿"\)/);
});

test("subject score-mode sync is idempotent", () => {
  assert.match(exam, /rawLabel\.textContent\s*!==\s*nextLabel/);
  assert.match(exam, /finalWrap\.hidden\s*!==\s*shouldHideFinal/);
  assert.match(exam, /final\.disabled\s*!==\s*shouldHideFinal/);
});

test("dashboard enhancements only watch top-level app rerenders", () => {
  assert.match(family, /observe\(appRoot,\s*\{\s*childList:\s*true\s*\}\)/);
  assert.match(shareCopy, /observe\(root,\s*\{\s*childList:\s*true\s*\}\)/);
  assert.match(trajectory, /observe\(v2Root,\{childList:true\}\)/);
  assert.match(onboarding, /observe\(root,\s*\{\s*childList:\s*true\s*\}\)/);
});

test("trajectory analysis does not cache exam lists across exam saves", () => {
  assert.doesNotMatch(trajectory, /lastExams|lastStudentId/);
  assert.match(trajectory, /v2CurrentExams/);
});
