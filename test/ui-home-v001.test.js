import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const app = await readFile(new URL("public/app.js", root), "utf8");
const css = await readFile(new URL("public/css/ui-foundation-v001.css", root), "utf8");
const index = await readFile(new URL("public/index.html", root), "utf8");
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const wrangler = await readFile(new URL("wrangler.toml", root), "utf8");

test("homepage uses the human-first reading order", () => {
  const start = app.indexOf("function renderOverview()");
  const end = app.indexOf("\nfunction renderExamList()", start);
  const source = app.slice(start, end);
  for (const marker of ["home-page", "home-latest", "home-change", "home-subjects", "home-actions"]) {
    assert.ok(source.includes(marker), "missing homepage marker: " + marker);
  }
  assert.match(source, /最近一次考试/);
  assert.match(source, /最近变化/);
  assert.match(source, /这次成绩/);
  assert.match(source, /其他科目可以之后补上/);
  assert.doesNotMatch(source, /还缺 .*科/);
});

test("main navigation keeps existing routes", () => {
  const start = app.indexOf("function renderDashboard()");
  const end = app.indexOf("\nfunction renderLogin", start);
  const source = app.slice(start, end);
  for (const tab of ["overview", "exams", "sharing", "family"]) {
    assert.match(source, new RegExp('data-tab="' + tab + '"'));
  }
  assert.match(source, /class="tabs app-main-tabs"/);
  assert.match(app, /home-view-tabs/);
});

test("header keeps behavior hooks while reducing visual noise", () => {
  const start = app.indexOf("function renderHeader()");
  const end = app.indexOf("\nfunction renderSubjectRows", start);
  const source = app.slice(start, end);
  for (const marker of ['id="student-select"', "account-menu", "privacy-note-lite", "home-topbar"]) {
    assert.ok(source.includes(marker), "missing header marker: " + marker);
  }
  assert.match(source, /data-tab-jump="family"/);
  assert.match(source, /data-action="export"/);
  assert.match(source, /data-action="logout"/);
});

test("homepage styles are responsive and touch-friendly", () => {
  for (const selector of [".home-page", ".home-latest", ".home-latest-grid", ".home-actions", ".home-view-tabs"]) {
    assert.ok(css.includes(selector), "missing style: " + selector);
  }
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /@media \(max-width:560px\)/);
  assert.match(css, /min-height:48px/);
});

test("release version is synchronized", () => {
  assert.equal(pkg.version, "0.14.2.1");
  assert.match(wrangler, /^APP_VERSION\s*=\s*"0\.14\.2\.2"/m);
  assert.match(index, /ui-foundation-v001\.css/);
});
