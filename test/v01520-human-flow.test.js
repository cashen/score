import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeExam } from "../src/lib/model.js";
import { resolveExamScope } from "../src/domain/exam.js";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const application = await readFile(new URL("../public/application-v001.js", import.meta.url), "utf8");
const css = await readFile(new URL("../public/css/ui-foundation-v001.css", import.meta.url), "utf8");

test("exam management sends users to reading before editing", () => {
  const section = app.slice(app.indexOf("function renderExamList"), app.indexOf("function shareFieldControls"));
  assert.match(section, /data-action="view-exam"/);
  assert.match(section, /这里是考试记录管理。点开先看记录，需要修改时再进入编辑。/);
});

test("exam detail keeps an explicit read route", () => {
  const section = app.slice(app.indexOf("function renderExamList"), app.indexOf("function shareFieldControls"));
  assert.match(section, /href="\\?view=timeline&exam=/);
  assert.match(app, /function renderExamDetail\\(/);
});

test("private navigation can preserve the selected exam", () => {
  assert.match(app, /state\\.tab === "exams"/);
  assert.match(app, /url\\.searchParams\\.set\\("exam"/);
  assert.match(application, /!\\["overview", "exams"\\]\\.includes\\(state\\.tab\\)/);
});

test("student switching loads before committing the new student", () => {
  const start = app.indexOf('document.querySelector("#student-select")');
  const end = app.indexOf('document.querySelectorAll("[data-action=\'new-exam\']")', start);
  const section = app.slice(start, end);
  assert.match(section, /const previousStudent = state\\.student/);
  assert.match(section, /await loadStudentData\\(nextStudent\\)/);
  assert.ok(section.indexOf("await loadStudentData(nextStudent)") < section.indexOf("state.student = nextStudent"));
});

test("family load failures remain distinguishable from an empty member list", () => {
  assert.match(app, /state\\.familyDataError/);
  assert.match(app, /data-action="retry-family"/);
});

test("absent exams can have no subject records", () => {
  const absent = normalizeExam({ name: "9月月考", date: "2026-09-28", type: "monthly", attendance: "absent", status: "absent", subjectSet: [], subjects: {} });
  assert.deepEqual(absent.subjectSet, []);
  assert.equal(resolveExamScope(absent).isEmpty, true);
});

test("attended exams still require a subject", () => {
  assert.throws(() => normalizeExam({ name: "9月月考", date: "2026-09-28", type: "monthly", attendance: "present", subjectSet: [], subjects: {} }), /至少选择一门科目/);
});

test("new exam date uses the local calendar", () => {
  assert.match(app, /function todayLocalDate\\(\\)/);
  assert.match(app, /exam\\?\\.date \\|\\| todayLocalDate\\(\\)/);
});

test("login retry preserves the entered username", () => {
  assert.match(app, /function renderLogin\\(error = "", username = ""\\)/);
  assert.match(app, /value="\\$\\{esc\\(username)\\}"/);
});

test("tab switching renders the target before waiting on secondary data", () => {
  const start = app.indexOf('document.querySelectorAll("[data-tab]")');
  const end = app.indexOf('document.querySelectorAll("[data-tab-jump]")', start);
  const section = app.slice(start, end);
  assert.ok(section.indexOf("renderDashboard();") < section.indexOf("await loadShares();"));
});

test("exam list row has no underline treatment", () => {
  assert.match(css, /\\.exam-list-row \\{ text-decoration: none; color: inherit; \\}/);
});
