export const SCORE_SUBJECTS = ["chinese", "math", "english", "physics", "chemistry", "biology"];

export function subjectScore(subject) {
  return subject?.finalScore ?? subject?.rawScore ?? null;
}

export function examScoreSummary(exam) {
  if (exam?.scoreSummary?.kind) return exam.scoreSummary;
  const values = SCORE_SUBJECTS.map(key => subjectScore(exam?.subjects?.[key])).filter(value => value != null);
  const recordedSubjects = values.length;
  const subtotal = recordedSubjects ? Math.round(values.reduce((sum, value) => sum + Number(value), 0) * 10) / 10 : null;
  const official = exam?.overall?.officialScore ?? exam?.officialScore ?? null;
  if (exam?.status === "absent") return { kind: "absent", value: null, subtotal, recordedSubjects, expectedSubjects: SCORE_SUBJECTS.length, complete: false };
  if (official != null) return { kind: "official", value: official, subtotal, recordedSubjects, expectedSubjects: SCORE_SUBJECTS.length, complete: recordedSubjects === SCORE_SUBJECTS.length };
  if (recordedSubjects === SCORE_SUBJECTS.length) return { kind: "calculated_complete", value: subtotal, subtotal, recordedSubjects, expectedSubjects: SCORE_SUBJECTS.length, complete: true };
  if (recordedSubjects) return { kind: "calculated_partial", value: null, subtotal, recordedSubjects, expectedSubjects: SCORE_SUBJECTS.length, complete: false };
  return { kind: "missing", value: null, subtotal: null, recordedSubjects: 0, expectedSubjects: SCORE_SUBJECTS.length, complete: false };
}

export function scoreSummaryText(summary) {
  const number = value => Number(value).toFixed(1).replace(/\.0$/, "");
  if (!summary || summary.kind === "missing") return "总分待补";
  if (summary.kind === "absent") return "本场缺考";
  if (summary.kind === "official") return `学校公布总分 ${number(summary.value)}`;
  if (summary.kind === "calculated_complete") return `六科合计 ${number(summary.value)}`;
  return `已录 ${summary.recordedSubjects}/${summary.expectedSubjects} 科，小计 ${number(summary.subtotal)}`;
}

export function examCompleteness(exam) {
  const score = examScoreSummary(exam);
  const missingSubjects = SCORE_SUBJECTS.filter(key => subjectScore(exam?.subjects?.[key]) == null);
  return { complete: score.kind === "absent" || missingSubjects.length === 0, missingSubjects, score };
}
