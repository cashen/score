export function comparisonCategory(type) {
  if (type === "joint" || type === "school") return "joint_school";
  if (["mock1", "mock2", "mock3"].includes(type)) return "mock";
  return type || "other";
}

export function percentile(rank, participants) {
  if (!Number.isInteger(rank) || !Number.isInteger(participants) || rank < 1 || participants < rank) return null;
  return Math.round((rank / participants) * 1000) / 10;
}

export function comparableRanking(a, b) {
  return Boolean(a && b && a.scope === b.scope && (a.label || "") === (b.label || "") && (a.basis || "final_score") === (b.basis || "final_score"));
}

function normalizedComparison(exam) {
  const comparison = exam?.comparison || {};
  return {
    series: String(comparison.series || "").trim(),
    level: String(comparison.level || "").trim()
  };
}

export function comparisonEligibility(latest, previous) {
  if (!latest || !previous) return { status: "baseline", reason: "还没有第二次可比考试" };
  if (comparisonCategory(latest.type) !== comparisonCategory(previous.type)) {
    return { status: "not_comparable", reason: "考试类别不同，暂不直接比较" };
  }
  const a = normalizedComparison(latest);
  const b = normalizedComparison(previous);
  if (a.series !== b.series) {
    return { status: "not_comparable", reason: "考试系列不同，暂不直接比较" };
  }
  if (a.level !== b.level) {
    return { status: "not_comparable", reason: "考试范围不同，暂不直接比较" };
  }
  if (!a.series || !a.level) {
    return { status: "comparable", reason: "同类别考试；部分比较口径未标注" };
  }
  return { status: "comparable", reason: "按" + a.level + "口径比较" };
}

export function comparisonReason(latest, previous) {
  return comparisonEligibility(latest, previous).reason;
}

export function comparableSet(exams = []) {
  const latest = exams[0];
  if (!latest) return [];
  return exams.filter((exam) => comparisonEligibility(latest, exam).status === "comparable" || exam.id === latest.id).slice(0, 6);
}

export function rankingFor(rankings, preferredScopes = ["school", "class"]) {
  for (const scope of preferredScopes) {
    const ranking = (rankings || []).find((item) => item?.scope === scope && (item.rank != null || item.participants != null));
    if (ranking) return ranking;
  }
  return null;
}
