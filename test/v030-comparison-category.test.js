import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("comparison categories keep school and joint exams together", () => {
  assert.match(app, /if \(type === "joint" \|\| type === "school"\) return "joint_school"/);
});

test("mock stages compare as one mock category", () => {
  assert.match(app, /\["mock1", "mock2", "mock3"\]\.includes\(type\)/);
  assert.match(app, /return "mock"/);
});

test("stored series wins only when at least two same-category exams exist", () => {
  assert.match(app, /const sameCategory = exams\.filter/);
  assert.match(app, /const sameSeries = sameCategory\.filter/);
  assert.match(app, /if \(sameSeries\.length >= 2\) return sameSeries\.slice\(0, 6\)/);
});
