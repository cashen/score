import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const draft = await readFile(new URL("../public/draft.js", import.meta.url), "utf8");

test("draft cleanup requires an explicit successful server save event", () => {
  assert.match(app, /score:save-succeeded/);
  assert.match(draft, /addEventListener\("score:save-succeeded"/);
  assert.doesNotMatch(draft, /submittedAt|wasSubmittedRecently/);
  assert.doesNotMatch(draft, /addEventListener\("submit"/);
});

test("an incomplete latest exam becomes the single continue action", () => {
  assert.match(app, /继续补充这次考试/);
  assert.match(app, /data-action="\$\{primaryAction\}"/);
  assert.match(app, /data-action='continue-exam'/);
  assert.match(app, /还缺/);
  assert.match(app, /检查并保存/);
  assert.match(app, /本机草稿尚未提交/);
});
