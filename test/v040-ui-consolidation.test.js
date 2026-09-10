import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");

test("home is a continuous reading flow instead of a three-card dashboard", () => {
  assert.match(app, /coordinate-hero/);
  assert.match(app, /和上一次可比考试相比/);
  assert.match(app, /变化较明显的科目/);
  assert.match(app, /六科/);
  assert.match(app, /查看完整轨迹/);
  assert.doesNotMatch(app, /现在在哪/);
  assert.doesNotMatch(app, /变化来自哪里/);
});

test("visual system uses one hero, sections and rows", () => {
  assert.match(css, /\.coordinate-hero,/);
  assert.match(css, /\.reading-section,/);
  assert.match(css, /\.subject-row/);
  assert.match(css, /\.exam-list-row/);
  assert.match(css, /\.member-row/);
});

test("v0.5 entry no longer loads v0.4 patch assets", () => {
  for (const asset of ["ui-v040", "ui-v041", "ui-v042", "trajectory-v3", "exam-humanize", "brand-v021"]) {
    assert.doesNotMatch(index, new RegExp(asset));
  }
  assert.match(index, /app-v094\.css/);
});

test("academic changes are described without red-good green-bad judgment", () => {
  assert.doesNotMatch(app, /发挥较好|发挥失常/);
  assert.match(app, /有特殊情况/);
});
