import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeExam } from '../src/lib/model.js';
import { resolveExamScope } from '../src/domain/exam.js';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const application = await readFile(new URL('../public/application-v001.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/css/ui-foundation-v001.css', import.meta.url), 'utf8');

test('exam management sends users to reading before editing', () => {
  const section = app.slice(app.indexOf('function renderExamList'), app.indexOf('function shareFieldControls'));
  assert.equal(section.includes('data-action="view-exam"'), true);
  assert.equal(section.includes('这里是考试记录管理。点开先看记录，需要修改时再进入编辑。'), true);
});

test('exam detail keeps an explicit read route', () => {
  const section = app.slice(app.indexOf('function renderExamList'), app.indexOf('function shareFieldControls'));
  assert.equal(section.includes('href="?view=timeline&exam='), true);
  assert.equal(app.includes('function renderExamDetail('), true);
});

test('private navigation can preserve the selected exam', () => {
  assert.equal(app.includes('state.tab === "exams"'), true);
  assert.equal(app.includes('url.searchParams.set("exam"'), true);
  assert.equal(application.includes('!["overview", "exams"].includes(state.tab)'), true);
});

test('student switching loads before committing the new student', () => {
  const start = app.indexOf('document.querySelector("#student-select")');
  const end = app.indexOf('document.querySelectorAll("[data-action=\'new-exam\']")', start);
  const section = app.slice(start, end);
  assert.equal(section.includes('const previousStudent = state.student'), true);
  assert.equal(section.includes('await loadStudentData(nextStudent)'), true);
  assert.ok(section.indexOf('await loadStudentData(nextStudent)') < section.indexOf('state.student = nextStudent'));
});

test('family load failures stay distinguishable from an empty member list', () => {
  assert.equal(app.includes('state.familyDataError'), true);
  assert.equal(app.includes('data-action="retry-family"'), true);
});

test('attendance status is visible in the third entry step', () => {
  assert.equal(app.includes('exam-attendance-inline'), true);
  assert.equal(app.includes('到场情况'), true);
});

test('absent exams can have no subject records', () => {
  const absent = normalizeExam({ name: '9月月考', date: '2026-09-28', type: 'monthly', attendance: 'absent', status: 'absent', subjectSet: [], subjects: {} });
  assert.deepEqual(absent.subjectSet, []);
  assert.equal(resolveExamScope(absent).isEmpty, true);
});

test('attended exams still require a subject', () => {
  assert.throws(() => normalizeExam({ name: '9月月考', date: '2026-09-28', type: 'monthly', attendance: 'present', subjectSet: [], subjects: {} }), /至少选择一门科目/);
});

test('new exam date uses the local calendar', () => {
  assert.equal(app.includes('function todayLocalDate()'), true);
  assert.equal(app.includes('exam?.date || todayLocalDate()'), true);
});

test('login retry preserves the entered username', () => {
  assert.equal(app.includes('function renderLogin(error = "", username = "")'), true);
  assert.equal(app.includes('value="${esc(username)}"'), true);
});

test('tab switching renders the target before waiting on secondary data', () => {
  const start = app.indexOf('document.querySelectorAll("[data-tab]")');
  const end = app.indexOf('document.querySelectorAll("[data-tab-jump]")', start);
  const section = app.slice(start, end);
  assert.ok(section.indexOf('renderDashboard();') < section.indexOf('await loadShares();'));
});

test('exam list row has no underline treatment', () => {
  assert.equal(css.includes('.exam-list-row { text-decoration: none; color: inherit; }'), true);
});
