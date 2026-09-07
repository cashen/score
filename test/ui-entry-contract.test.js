import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const enhancer = readFileSync(new URL("../public/exam-humanize.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/exam-humanize.css", import.meta.url), "utf8");

test("exam entry enhancement assets are loaded", () => {
  assert.match(html, /exam-humanize\.css/);
  assert.match(html, /exam-humanize\.js/);
});

test("human exam entry keeps the existing form field contract", () => {
  for (const name of [
    "officialScore",
    "overall-class-rank",
    "overall-class-participants",
    "overall-school-rank",
    "overall-school-participants"
  ]) assert.match(enhancer, new RegExp(name));

  for (const subject of ["chinese", "math", "english", "physics", "chemistry", "biology"]) {
    assert.match(enhancer, new RegExp(`\\[\\"${subject}\\"`));
  }
});

test("subject entry is card based and responsive instead of a horizontal matrix", () => {
  assert.match(enhancer, /exam-subject-card/);
  assert.match(enhancer, /exam-rank-pair/);
  assert.match(css, /\.exam-subject-cards\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /\.exam-subject-cards\s*\{\s*grid-template-columns:\s*1fr/);
});
