import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const semantics = await readFile(new URL("../public/record-semantics-v120.js", import.meta.url), "utf8");

test("comparison metadata stays optional and out of the primary exam path", () => {
  assert.match(app, /更多考试信息（可选）/);
  assert.match(app, /考试范围/);
  assert.match(app, /属于同一个考试系列/);
  assert.match(app, /comparison:\s*\{ series:/);
});

test("comparison copy avoids causal claims", () => {
  assert.match(app, /变化较明显的科目/);
  assert.doesNotMatch(app, /变化来自哪里/);
  assert.match(app, /先看事实，再决定下一步/);
});

test("overall comparison prefers relative position before score", () => {
  assert.match(semantics, /metric === "auto" \\|\\| metric === "schoolRank"/);
  assert.match(semantics, /kind: "percentile"/);
  assert.match(semantics, /kind: "school-rank"/);
  assert.match(semantics, /kind: "class-rank"/);
  assert.match(semantics, /kind: "score"/);
  assert.ok(semantics.indexOf('kind: "percentile"') < semantics.indexOf('kind: "school-rank"'));
  assert.ok(semantics.indexOf('kind: "school-rank"') < semantics.indexOf('kind: "class-rank"'));
  assert.ok(semantics.indexOf('kind: "class-rank"') < semantics.indexOf('kind: "score"'));
});
