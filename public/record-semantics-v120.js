export const SUBJECT_KEYS = Object.freeze(["chinese", "math", "english", "physics", "chemistry", "biology"]);

const EXAM_TYPES = new Set(["weekly", "monthly", "midterm", "final", "school", "joint", "mock1", "mock2", "mock3", "other"]);

export function examComparisonCategory(value) {
  const type = typeof value === "string" ? value : value?.type;
  if (type === "joint" || type === "school") return "joint_school";
  if (["mock1", "mock2", "mock3"].includes(type)) return "mock";
  return EXAM_TYPES.has(type) ? type : "other";
}

function normalizedComparison(exam) {
  const comparison = exam?.comparison || {};
  return {
    series: String(comparison.series || "").trim(),
    level: String(comparison.level || "").trim()
  };
}

export function comparisonEligibility(latest, previous) {
  if (!latest || !previous) return { status: "baseline", reason: "还没有第二次可以直接比较的考试" };
  const unavailable = exam => exam?.status && exam.status !== "normal";
  if (unavailable(latest)) return { status: "not_comparable", reason: "这次考试有特殊情况，暂不直接比较" };
  if (unavailable(previous)) return { status: "not_comparable", reason: "对比的考试有特殊情况，暂不直接比较" };
  if (examComparisonCategory(latest) !== examComparisonCategory(previous)) {
    return { status: "not_comparable", reason: "考试类别不同，暂不直接比较" };
  }
  const a = normalizedComparison(latest);
  const b = normalizedComparison(previous);
  if (a.series !== b.series) return { status: "not_comparable", reason: "考试系列不同，暂不直接比较" };
  if (a.level !== b.level) return { status: "not_comparable", reason: "考试范围不同，暂不直接比较" };
  if (!a.series || !a.level) return { status: "comparable", reason: "考试类别相同，但比较范围信息不完整" };
  return { status: "comparable", reason: "按" + a.level + "范围比较" };
}

export const comparisonCategory = examComparisonCategory;

export function compareExamsChronologically(a, b) {
  return String(b?.date || "").localeCompare(String(a?.date || "")) ||
    String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")) ||
    String(a?.id || "").localeCompare(String(b?.id || ""));
}

export function sortExamsChronologically(exams = []) {
  return [...exams].sort(compareExamsChronologically);
}

export function latestExam(exams = []) {
  return sortExamsChronologically(exams)[0] || null;
}

export function comparableRanking(a, b) {
  if (!a || !b) return false;
  return a.scope === b.scope &&
    (a.label || "") === (b.label || "") &&
    (a.basis || "final_score") === (b.basis || "final_score");
}

export function percentile(rank, participants) {
  if (!Number.isInteger(rank) || !Number.isInteger(participants) || rank < 1 || participants < rank) return null;
  return Math.round((rank / participants) * 1000) / 10;
}

export function rankingState(rankings, scope) {
  const item = (rankings || []).find((entry) => entry?.scope === scope && (entry.rank != null || entry.participants != null)) || null;
  return {
    exists: Boolean(item),
    rank: item?.rank ?? null,
    participants: item?.participants ?? null,
    percentile: item ? percentile(item.rank, item.participants) : null,
    item
  };
}

export function subjectRecordState(exam, key) {
  const subject = exam?.subjects?.[key] || {};
  const score = subject.finalScore ?? subject.rawScore ?? null;
  const rankings = Array.isArray(subject.rankings) ? subject.rankings : [];
  const hasRanking = rankings.some((item) => item?.rank != null || item?.participants != null);
  const hasScore = score != null;
  return {
    status: hasScore || hasRanking ? "recorded" : "empty",
    hasAny: hasScore || hasRanking,
    hasScore,
    hasRanking,
    score,
    rankings,
    subject
  };
}

function overallRankingState(exam, scope) {
  return rankingState(exam?.overall?.rankings || exam?.overallRankings, scope);
}

function subjectRankingState(exam, key, scope) {
  return rankingState(exam?.subjects?.[key]?.rankings, scope);
}

function subjectScore(exam, key) {
  return subjectRecordState(exam, key).score;
}

function overallScore(exam) {
  return exam?.overall?.officialScore ?? exam?.overall?.calculatedScore ?? exam?.overallScore ?? null;
}

export function metricBetween(latest, previous, key = null, metric = "auto") {
  if (!latest || !previous) return null;
  if (comparisonEligibility(latest, previous).status !== "comparable") return null;

  const schoolCurrent = key ? subjectRankingState(latest, key, "school") : overallRankingState(latest, "school");
  const schoolPrevious = key ? subjectRankingState(previous, key, "school") : overallRankingState(previous, "school");
  if (metric === "auto" || metric === "schoolRank") {
    if (schoolCurrent.item && schoolPrevious.item && comparableRanking(schoolCurrent.item, schoolPrevious.item)) {
      if (schoolCurrent.percentile != null && schoolPrevious.percentile != null) {
        return {
          kind: "percentile",
          metric: "schoolRank",
          delta: schoolPrevious.percentile - schoolCurrent.percentile,
          currentValue: schoolCurrent.percentile,
          previousValue: schoolPrevious.percentile,
          detail: `校内前 ${schoolPrevious.percentile}% → 校内前 ${schoolCurrent.percentile}%`
        };
      }
      if (schoolCurrent.rank != null && schoolPrevious.rank != null) {
        return {
          kind: "school-rank",
          metric: "schoolRank",
          delta: schoolPrevious.rank - schoolCurrent.rank,
          currentValue: schoolCurrent.rank,
          previousValue: schoolPrevious.rank,
          detail: `校内第 ${schoolPrevious.rank} → 校内第 ${schoolCurrent.rank}`
        };
      }
    }
    if (metric === "schoolRank") return null;
  }

  const classCurrent = key ? subjectRankingState(latest, key, "class") : overallRankingState(latest, "class");
  const classPrevious = key ? subjectRankingState(previous, key, "class") : overallRankingState(previous, "class");
  if (metric === "auto" || metric === "classRank") {
    if (classCurrent.item && classPrevious.item && comparableRanking(classCurrent.item, classPrevious.item) && classCurrent.rank != null && classPrevious.rank != null) {
      return {
        kind: "class-rank",
        metric: "classRank",
        delta: classPrevious.rank - classCurrent.rank,
        currentValue: classCurrent.rank,
        previousValue: classPrevious.rank,
        detail: `班级第 ${classPrevious.rank} → 班级第 ${classCurrent.rank}`
      };
    }
    if (metric === "classRank") return null;
  }

  if (metric === "auto" || metric === "score") {
    const currentScore = key ? subjectScore(latest, key) : overallScore(latest);
    const previousScore = key ? subjectScore(previous, key) : overallScore(previous);
    if (currentScore != null && previousScore != null) {
      return {
        kind: "score",
        metric: "score",
        delta: currentScore - previousScore,
        currentValue: currentScore,
        previousValue: previousScore,
        detail: `${previousScore} → ${currentScore} 分`
      };
    }
  }
  return null;
}

export function findComparableExam(exams = [], current = latestExam(exams)) {
  const sorted = sortExamsChronologically(exams);
  if (!current) return { status: "baseline", current: null, reference: null, skipped: [], reason: "还没有考试记录" };
  const index = sorted.findIndex(exam => exam.id === current.id);
  const start = index >= 0 ? index : 0;
  const skipped = [];
  for (const candidate of sorted.slice(start + 1)) {
    const eligibility = comparisonEligibility(current, candidate);
    if (eligibility.status === "comparable") return { ...eligibility, current, reference: candidate, skipped };
    skipped.push({ id: candidate.id, reason: eligibility.reason });
  }
  return {
    status: "baseline",
    current,
    reference: null,
    skipped,
    reason: skipped.length ? `之前有 ${skipped.length} 场考试，但没有找到可以直接比较的考试` : "还没有第二次可以直接比较的考试"
  };
}

export function findComparableExamForSubject(exams = [], current = latestExam(exams), key, metric = "auto") {
  const ordered = sortExamsChronologically(exams);
  if (!current) return { status: "baseline", current: null, reference: null, metric: null, skipped: [], reason: "还没有考试记录" };
  const currentState = subjectRecordState(current, key);
  if (!currentState.hasAny) {
    return { status: "not_comparable", current, reference: null, metric: null, skipped: [], reason: "当前科目没有已记录数据，暂不判断变化" };
  }

  const index = ordered.findIndex(exam => exam.id === current.id);
  const skipped = [];
  let comparisonCandidateFound = false;

  for (const candidate of ordered.slice((index >= 0 ? index : 0) + 1)) {
    const eligibility = comparisonEligibility(current, candidate);
    if (eligibility.status !== "comparable") {
      skipped.push({ id: candidate.id, reason: eligibility.reason });
      continue;
    }
    comparisonCandidateFound = true;
    const candidateState = subjectRecordState(candidate, key);
    if (!candidateState.hasAny) {
      skipped.push({ id: candidate.id, reason: "当前科目没有已记录数据，不能比较" });
      continue;
    }
    const change = metricBetween(current, candidate, key, metric);
    if (change) {
      return { status: "comparable", current, reference: candidate, metric: change, skipped, reason: eligibility.reason };
    }
    skipped.push({
      id: candidate.id,
      reason: metric === "schoolRank" ? "学校排名数据不足，不能比较" : metric === "classRank" ? "班级排名数据不足，不能比较" : "当前科目缺少足够的共同数据，不能比较"
    });
  }

  let reason = "还没有第二次可以直接比较的考试";
  if (comparisonCandidateFound && skipped.length) reason = "有同类别考试，但这门课缺少足够的共同数据，暂不判断变化";
  else if (skipped.length) reason = "已有历史记录，但之前的考试条件不同，暂不直接比较";
  return { status: "not_comparable", current, reference: null, metric: null, skipped, reason };
}

export function comparableSet(exams = []) {
  const ordered = sortExamsChronologically(exams);
  const current = ordered[0];
  if (!current) return [];
  return ordered.filter((exam) => exam.id === current.id || comparisonEligibility(current, exam).status === "comparable").slice(0, 6);
}

export function comparisonReason(latest, previous) {
  return comparisonEligibility(latest, previous).reason;
}
