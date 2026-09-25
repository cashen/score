import { examScoreSummary, subjectScore } from "./score-core-v090.js";
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
  if (value != null) return "score";
  const rankings = key ? exam?.subjects?.[key]?.rankings : (exam?.overall?.rankings || exam?.overallRankings);
  if (rankingState(rankings, "school").rank != null) return "schoolRank";
  if (rankingState(rankings, "class").rank != null) return "classRank";
  return "score";
}

export function recordCompleteness(exam) {
  const score = examScoreSummary(exam);
  const absent = score.kind === "absent";
  const missingSubjects = absent ? [] : SUBJECTS.filter(([key]) => subjectScore(exam?.subjects?.[key]) == null).map(([, label]) => label);
  const schoolRank = rankingState(exam?.overall?.rankings || exam?.overallRankings, "school");
  const classRank = rankingState(exam?.overall?.rankings || exam?.overallRankings, "class");
  return {
    subjectCount: score.recordedSubjects,
    subjectTotal: score.expectedSubjects,
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
  const pieces = ["已记 " + state.subjectCount + "/" + state.subjectTotal + " 科"];
  if (state.officialTotal) pieces.push("学校公布总分已记");
  else if (state.isSubjectComplete) pieces.push("六科合计已记录 · 学校公布总分待补");
  else pieces.push("学校公布总分待补");
  const positions = [state.hasSchoolRank ? "学校排名已记" : null, state.hasClassRank ? "班级排名已记" : null].filter(Boolean);
  if (positions.length) pieces.push(positions.join("、"));
  return { line: pieces.join(" · "), nextAction: state.missingSubjects.length || !state.officialTotal ? "继续补这场考试" : "记录下一场考试" };
}

export function shareBehaviorLabel({ scope = "single", mode = "live" } = {}) {
  if (mode === "snapshot") return "固定当前内容";
  if (scope === "trajectory") return "历次成绩会持续更新，以后新增的考试也会显示";
  return "这场考试会随记录更新，但以后新增的考试不会加入";
}
