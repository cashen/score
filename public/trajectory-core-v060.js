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

export function comparisonReason(latest, previous) {
  if (!latest || !previous) return "还没有第二次可比考试";
  if (comparisonCategory(latest.type) !== comparisonCategory(previous.type)) return "考试类别不同，暂不直接比较";
  const a = latest.comparison || {}, b = previous.comparison || {};
  if (a.level && b.level && a.level !== b.level) return "考试范围不同，暂不直接比较";
  if (a.series && b.series && a.series !== b.series) return "考试系列不同，暂不直接比较";
  return a.level || b.level ? `按${a.level || b.level}口径比较` : "同类别考试；未标注统一口径";
}

export function comparableSet(exams = []) {
  const latest = exams[0];
  if (!latest) return [];
  const category = comparisonCategory(latest.type);
  const sameCategory = exams.filter((exam) => comparisonCategory(exam.type) === category);
  const series = latest.comparison?.series?.trim();
  if (series) {
    const sameSeries = sameCategory.filter((exam) => exam.comparison?.series?.trim() === series);
    if (sameSeries.length >= 2) return sameSeries.slice(0, 6);
  }
  return sameCategory.filter((exam) => {
    const level = latest.comparison?.level && exam.comparison?.level;
    return !level || latest.comparison.level === exam.comparison.level;
  }).slice(0, 6);
}

export function rankingFor(rankings, preferredScopes = ["school", "class"]) {
  for (const scope of preferredScopes) {
    const ranking = (rankings || []).find((item) => item?.scope === scope && (item.rank != null || item.participants != null));
    if (ranking) return ranking;
  }
  return null;
}
