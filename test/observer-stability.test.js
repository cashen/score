import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const exam = await readFile(new URL("../public/exam-humanize.js", import.meta.url), "utf8");
const draft = await readFile(new URL("../public/draft.js", import.meta.url), "utf8");
const family = await readFile(new URL("../public/family-management.js", import.meta.url), "utf8");

test("exam enhancement does not observe the whole document subtree", () => {
  assert.doesNotMatch(exam, /observe\(document\.documentElement\s*,\s*\{[^}]*subtree\s*:\s*true/s);
  assert.match(exam, /observe\(document\.body,\s*\{\s*childList:\s*true\s*\}\)/);
});

test("draft restore is explicit and does not depend on repeated DOM text scanning", () => {
  assert.match(draft, /score:draft-restored/);
  assert.match(draft, /dataset\.draftRestored\s*=\s*"1"/);
  assert.doesNotMatch(draft, /observe\(document\.documentElement\s*,\s*\{[^}]*subtree\s*:\s*true/s);
  assert.doesNotMatch(exam, /includes\("已恢复本机未同步草稿"\)/);
});

test("subject score-mode sync is idempotent", () => {
  assert.match(exam, /rawLabel\.textContent\s*!==\s*nextLabel/);
  assert.match(exam, /finalWrap\.hidden\s*!==\s*shouldHideFinal/);
  assert.match(exam, /final\.disabled\s*!==\s*shouldHideFinal/);
});

test("family management only watches top-level app rerenders", () => {
  assert.doesNotMatch(family, /observe\(document\.documentElement\s*,\s*\{[^}]*subtree\s*:\s*true/s);
  assert.match(family, /observe\(appRoot,\s*\{\s*childList:\s*true\s*\}\)/);
});
