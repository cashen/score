import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("single-exam public views explain the current baseline without inventing a trend", () => {
  assert.match(app, /function publicBaselineV081\(view, exams\)/);
  assert.match(app, /exams\.length !== 1/);
  assert.match(app, /当前基线/);
  assert.match(app, /不判断变化/);
  assert.match(app, /有下一次同口径记录后再比较/);
  assert.doesNotMatch(app, /当前基线[^]*?(预测|能力判断|必然进步)/);
});

test("the ink treatment is scoped to external share rendering", () => {
  assert.match(app, /class="public-shell ink-share"/);
  assert.match(app, /data-share-view=/);
  assert.match(app, /data-exam-count=/);
  assert.match(app, /publicBaselineV081\("total"/);
  assert.match(app, /publicBaselineV081\("subject"/);
  assert.match(app, /publicBaselineV081\("timeline"/);
});
