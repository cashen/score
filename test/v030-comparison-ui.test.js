import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const coord = await readFile(new URL("../public/trajectory-v3-coordination.js", import.meta.url), "utf8");

test("comparison coordinator is installed before app bootstrap", () => {
  assert.ok(index.indexOf("trajectory-v3-coordination.js") < index.indexOf("router-v2.js"));
});

test("trend grouping follows exam category rules", () => {
  assert.match(coord, /type === "joint" \|\| type === "school"/);
  assert.match(coord, /return "joint_school"/);
  assert.match(coord, /monthly: "月考"/);
  assert.match(coord, /mock1.*mock2.*mock3/);
  assert.match(coord, /sameSeriesCount >= 2/);
});

test("exam entry exposes school exam and joint ranking with optional participant count", () => {
  assert.match(coord, /option\.value = "school"/);
  assert.match(coord, /option\.textContent = "校考"/);
  assert.match(coord, /联考位次/);
  assert.match(coord, /联考人数（可不填）/);
  assert.match(coord, /overall-joint-rank-v3/);
  assert.match(coord, /overall-joint-participants-v3/);
  assert.match(coord, /scope: "joint"/);
});

test("joint position can appear on trajectory summary and shared exam timeline", () => {
  assert.match(coord, /data-v3-joint-summary/);
  assert.match(coord, /data-v3-joint-timeline/);
  assert.match(coord, /联考总人数未填，仅保留位次/);
});

test("coordination remains bounded and never observes a broad subtree", () => {
  assert.doesNotMatch(coord, /subtree\s*:\s*true/);
  assert.match(coord, /observe\(v3CoordApp, \{ childList: true \}\)/);
  assert.match(coord, /observe\(document\.body, \{ childList: true \}\)/);
});
