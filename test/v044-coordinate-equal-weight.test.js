import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/ui-v050.css", import.meta.url), "utf8");

test("school, class and score share one typography rule", () => {
  assert.match(app, /items\.map\(\(item\) => `<span>\$\{esc\(item\)\}<\/span>`\)/);
  assert.match(css, /\.coordinate-row > span\s*\{[\s\S]*font-size:\s*24px;[\s\S]*font-weight:\s*650/);
  assert.doesNotMatch(css, /\.coordinate-row[^}]*:first-child[^}]*font-size/);
});

test("coordinates are smaller than the student identity", () => {
  assert.match(css, /\.hero-head h1,[\s\S]*font-size:\s*31px/);
  assert.match(css, /\.coordinate-row > span[\s\S]*font-size:\s*24px/);
});

test("coordinate labels are explicit enough to stand without field headings", () => {
  assert.match(app, /`\$\{prefix\}第 \$\{ranking\.rank\} 名`/);
  assert.match(app, /`${fmtNumber\(score\)} 分`/);
});
