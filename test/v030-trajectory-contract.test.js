import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");

test("deep trajectory is secondary to the current coordinate", () => {
  assert.match(app, /<details class="deep-trajectory"/);
  assert.match(app, /查看完整轨迹/);
  assert.match(app, /历次整体位置与六科历史/);
  assert.match(css, /\.deep-trajectory/);
});

test("trajectory shows facts instead of opaque stability labels", () => {
  assert.match(app, /function renderDeepTrajectory\(/);
  assert.match(app, /history-coordinate/);
  assert.match(app, /subject-history-row/);
  assert.doesNotMatch(app, /波动较大|较稳定/);
});

test("missing participants never invent a percentile", () => {
  assert.match(app, /function percentile\(rank, participants\)/);
  assert.match(app, /!Number\.isInteger\(participants\)/);
  assert.match(app, /schoolPct != null/);
});
