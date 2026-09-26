import { examScoreSummary, subjectScore, scoreConsistency } from "./score-core-v090.js";
import { resolveExamScope, subjectLabel } from "./exam-scope.js";
import { rankingState } from "./record-semantics-v120.js";

const SUBJECTS = Object.freeze([
  ["chinese", "语文"],
  ["math", "数学"],
  ["english", "英语"],
  ["physics", "物理"],
  ["chemistry", "化学"],
  ["biology", "生物"]
]);

export function resolveDisplayMetric(exam, key = null, requested = "auto") {
  if (requested !== "auto") return requested;
  const value = key ? subjectScore(exam?.subjects?.[key]) : examScoreSummary(exam).value;
  const rankings = key ? exam?.subjects?.[key]?.rankings : (exam?.overall?.rankings || exam?.overallRankings);
  if (rankingState(rankings, "school").rank != null) return "schoolRank";
  if (rankingState(rankings, "class").rank != null) return "classRank";
  if (value != null) return "score";
  return "score";
}

export function recordCompleteness(exam) {
  const score = examScoreSummary(exam);
  const scope = resolveExamScope(exam);
  const absent = score.kind === "absent";
  const missingSubjects = absent ? [] : scope.subjects.filter((key) => subjectScore(exam?.subjects?.[key]) == null).map(subjectLabel);
  const schoolRank = rankingState(exam?.overall?.rankings || exam?.overallRankings, "school");
  const classRank = rankingState(exam?.overall?.rankings || exam?.overallRankings, "class");
  return {
    subjectCount: score.recordedSubjects,
    subjectTotal: score.expectedSubjects,
    subjects: scope.subjects,
    missingSubjects,
    officialTotal: score.kind === "official",
    hasAnyTotal: score.value != null,
    hasSchoolRank: schoolRank.rank != null,
    hasClassRank: classRank.rank != null,
    absent,
    isSubjectComplete: absent || missingSubjects.length === 0,
    score
  };
}

export function recordSaveSummary(exam) {
  const state = recordCompleteness(exam);
  if (state.absent) return { line: "本场缺考", nextAction: "记录下一场考试" };
  const subjectNames = state.subjects.map(subjectLabel).join("、");
  const pieces = state.subjectTotal === 1
    ? [state.missingSubjects.length ? subjectNames + "待补" : subjectNames + "成绩已记录"]
    : ["已记 " + state.subjectCount + "/" + state.subjectTotal + " 科"];
  if (state.subjectTotal > 1) {
    if (state.officialTotal) pieces.push("学校公布总分已记");
    else if (state.isSubjectComplete && state.subjectTotal === 6) pieces.push("六科成绩已记全 · 学校公布总分待补");
    else if (state.isSubjectComplete) pieces.push("本次科目成绩已记全");
    else pieces.push("还有科目成绩待补");
  } else if (state.officialTotal) {
    pieces.push("学校公布总分已记");
  }
  const consistency = scoreConsistency(exam);
  if (consistency.status === "mismatch") pieces.push("学校公布总分与各科合计相差 " + Math.abs(consistency.delta) + " 分，请核对");
  const positions = [state.hasSchoolRank ? "学校排名已记" : null, state.hasClassRank ? "班级排名已记" : null].filter(Boolean);
  if (positions.length) pieces.push(positions.join("、"));
  const needsMore = state.missingSubjects.length || (state.subjectTotal === 6 && !state.officialTotal);
  return { line: pieces.join(" · "), nextAction: needsMore ? "继续补这场考试" : "记录下一场考试" };
}

export function shareBehaviorLabel({ scope = "single", mode = "live" } = {}) {
  if (mode === "snapshot") return "固定当前内容";
  if (scope === "trajectory") return "历次成绩会持续更新，以后新增的考试也会显示";
  return "这场考试会随记录更新，但以后新增的考试不会加入";
}
