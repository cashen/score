import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/ui-v050.css", import.meta.url), "utf8");

test("exam entry is rendered directly without legacy humanizer assets", () => {
  assert.doesNotMatch(html, /exam-humanize\.(?:css|js)/);
  assert.match(app, /function examDialog\(/);
  assert.match(app, /这次是什么考试/);
  assert.match(app, /总分与整体位置/);
  assert.match(app, /六科成绩与排名/);
});

test("direct exam renderer preserves score and rank payload fields", () => {
  for (const name of ["officialScore", "overall-school-rank", "overall-school-participants", "overall-class-rank", "overall-class-participants"]) {
    assert.match(app, new RegExp(name));
  }
  for (const subject of ["chinese", "math", "english", "physics", "chemistry", "biology"]) assert.match(app, new RegExp(`\\["${subject}"`));
  assert.match(app, /deriveDataStatus/);
  assert.doesNotMatch(app, /<label>数据状态<\/label>/);
});

test("subject entry reflows instead of using a horizontal matrix", () => {
  assert.match(app, /exam-subject-card/);
  assert.match(app, /rank-pair/);
  assert.match(css, /\.exam-subject-cards\s*\{[^}]*grid-template-columns:\s*repeat\(2/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.exam-subject-cards[^}]*grid-template-columns:\s*1fr/);
});
