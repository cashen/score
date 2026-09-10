import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");
const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("core senior-year tasks remain available in v0.5", () => {
  assert.match(app, /data-tab="overview">轨迹/);
  assert.match(app, /data-tab="exams">考试/);
  assert.match(app, /data-tab="sharing">分享/);
  assert.match(app, /data-tab="family">家庭/);
  assert.match(app, /data-action="new-exam"/);
  assert.match(app, /data-action="export"/);
});

test("mobile exam list keeps coordinates instead of hiding metrics", () => {
  assert.match(app, /exam-list-coordinate/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.exam-list-coordinate\s*\{[\s\S]*grid-column:\s*1/);
  assert.doesNotMatch(css, /\.exam-list-coordinate[^}]*display:\s*none/);
});

test("entry shell is minimal and has one active application router", () => {
  assert.match(index, /app-v094\.css/);
  assert.match(index, /router-v2\.js/);
  assert.doesNotMatch(index, /ui-v04[0-9]\.js/);
});
