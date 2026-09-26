import { resolveExamScope, subjectLabel } from "./exam-scope.js";

export const SCORE_SUBJECTS = ["chinese", "math", "english", "physics", "chemistry", "biology"];

export function subjectScore(subject) {
  return subject?.finalScore ?? subject?.rawScore ?? null;
}

export function examScoreSummary(exam) {
  if (exam?.scoreSummary?.kind) return exam.scoreSummary;
  const scope = resolveExamScope(exam);
  const expectedSubjectKeys = scope.subjects;
  const values = expectedSubjectKeys.map(key => subjectScore(exam?.subjects?.[key])).filter(value => value != null);
  const recordedSubjects = values.length;
  const subtotal = recordedSubjects ? Math.round(values.reduce((sum, value) => sum + Number(value), 0) * 10) / 10 : null;
  const official = exam?.overall?.officialScore ?? exam?.officialScore ?? null;
  if (exam?.attendance === "absent" || exam?.status === "absent") return { kind: "absent", value: null, subtotal, recordedSubjects, expectedSubjects: expectedSubjectKeys.length, expectedSubjectKeys, complete: false, label: "本场缺考" };
  if (official != null) return { kind: "official", value: official, subtotal, recordedSubjects, expectedSubjects: expectedSubjectKeys.length, expectedSubjectKeys, complete: recordedSubjects === expectedSubjectKeys.length, label: "总分" };
  if (recordedSubjects === expectedSubjectKeys.length) {
    const label = expectedSubjectKeys.length === 6 ? "六科合计" : expectedSubjectKeys.length === 1 ? subjectLabel(expectedSubjectKeys[0]) : "本次科目合计";
    return { kind: "calculated_complete", value: subtotal, subtotal, recordedSubjects, expectedSubjects: expectedSubjectKeys.length, expectedSubjectKeys, complete: true, label };
  }
  if (recordedSubjects) return { kind: "calculated_partial", value: null, subtotal, recordedSubjects, expectedSubjects: expectedSubjectKeys.length, expectedSubjectKeys, complete: false, label: expectedSubjectKeys.length === 6 ? recordedSubjects + "/6 科小计" : "已录 " + recordedSubjects + "/" + expectedSubjectKeys.length + " 科" };
  return { kind: "missing", value: null, subtotal: null, recordedSubjects: 0, expectedSubjects: expectedSubjectKeys.length, expectedSubjectKeys, complete: false, label: expectedSubjectKeys.length === 6 ? "总分待补" : "成绩待补" };
}

export function scoreConsistency(exam) {
  const stored = exam?.overall?.scoreConsistency;
  if (stored?.status) return stored;
  const summary = examScoreSummary(exam);
  const official = exam?.overall?.officialScore ?? exam?.officialScore ?? null;
  const complete = summary.expectedSubjects > 0 && summary.recordedSubjects === summary.expectedSubjects;
  if (official == null || summary.subtotal == null || !complete) return { status: "not_checked", officialScore: official, calculatedScore: summary.subtotal, delta: null };
  const delta = Math.round((summary.subtotal - official) * 10) / 10;
  return { status: Math.abs(delta) < 0.05 ? "match" : "mismatch", officialScore: official, calculatedScore: summary.subtotal, delta };
}

export function scoreConsistencyText(exam) {
  const state = scoreConsistency(exam);
  if (state.status === "mismatch") return "学校公布总分与各科合计不一致，请核对";
  if (state.status === "match") return "学校公布总分与各科合计一致";
  return "";
}

export function scoreSummaryText(summary) {
  const number = value => Number(value).toFixed(1).replace(/\.0$/, "");
  if (!summary || summary.kind === "missing") return summary?.label || "总分待补";
  if (summary.kind === "absent") return "本场缺考";
  if (summary.kind === "official") return `学校公布总分 ${number(summary.value)} 分`;
  if (summary.kind === "calculated_complete") return summary.expectedSubjects === 1 ? `${summary.label} ${number(summary.value)} 分` : summary.expectedSubjects === 6 ? `六科合计 ${number(summary.value)} 分` : `本次 ${summary.expectedSubjects} 科合计 ${number(summary.value)} 分`;
  if (summary.kind === "calculated_partial") return summary.expectedSubjects === 6 ? `已录 ${summary.recordedSubjects}/6 科，小计 ${number(summary.subtotal)} 分` : `已录 ${summary.recordedSubjects}/${summary.expectedSubjects} 科`;
  return "成绩待补";
}

export function examCompleteness(exam) {
  const score = examScoreSummary(exam);
  const missingSubjects = resolveExamScope(exam).subjects.filter(key => subjectScore(exam?.subjects?.[key]) == null);
  return { complete: score.kind === "absent" || missingSubjects.length === 0, missingSubjects, score };
}
