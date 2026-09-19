import { SUBJECT_KEYS, comparisonEligibility, sortExamsChronologically, percentile, subjectRecordState, metricBetween } from "./record-semantics-v120.js";

const RECENT_WINDOW = 5;

export function subjectObservationExams(exams = [], key = null) {
  const ordered = sortExamsChronologically(exams);
  if (!key) return ordered;
  return ordered.filter((exam) => subjectRecordState(exam, key).hasAny);
}

function rankItem(exam, key, scope) {
  const rankings = key
    ? exam?.subjects?.[key]?.rankings
    : exam?.overall?.rankings || exam?.overallRankings;
  return (rankings || []).find((item) => item?.scope === scope && (item.rank != null || item.participants != null)) || null;
}

function scoreValue(exam, key) {
  if (key) {
    const subject = exam?.subjects?.[key] || {};
    return subject.finalScore ?? subject.rawScore ?? null;
  }
  return exam?.overall?.officialScore ?? exam?.overall?.calculatedScore ?? exam?.overallScore ?? null;
}

function candidateMetric(exam, key, metric) {
  if (metric === "schoolRank") {
    const item = rankItem(exam, key, "school");
    if (!item) return null;
    const pct = percentile(item.rank, item.participants);
    return pct != null
      ? { metric, kind: "percentile", value: pct, directionValue: 100 - pct, display: `校内前 ${pct}%`, item }
      : item.rank != null
        ? { metric, kind: "school-rank", value: item.rank, directionValue: -item.rank, display: `校内第 ${item.rank} 名`, item }
        : null;
  }
  if (metric === "classRank") {
    const item = rankItem(exam, key, "class");
    return item?.rank != null
      ? { metric, kind: "class-rank", value: item.rank, directionValue: -item.rank, display: `班第 ${item.rank} 名`, item }
      : null;
  }
  if (metric === "score") {
    const value = scoreValue(exam, key);
    return value == null ? null : { metric, kind: "score", value, directionValue: value, display: `${value} 分` };
  }
  return null;
}

function canCompareMetric(a, b, metric) {
  if (!a || !b) return false;
  if (metric === "schoolRank" || metric === "classRank") return Boolean(a.item && b.item && a.item.scope === b.item.scope && (a.item.label || "") === (b.item.label || "") && (a.item.basis || "final_score") === (b.item.basis || "final_score"));
  return true;
}

export function chooseTrajectoryMetric(exams = [], key = null, preferred = "auto") {
  if (preferred && preferred !== "auto") return preferred;
  const ordered = subjectObservationExams(exams, key);
  const current = ordered[0];
  if (!current) return "score";
  const candidates = ["schoolRank", "classRank", "score"];
  if (ordered.length === 1) {
    for (const metric of candidates) if (candidateMetric(current, key, metric)) return metric;
  }
  for (const metric of candidates) {
    let count = 0;
    for (const exam of ordered) {
      if (comparisonEligibility(current, exam).status !== "comparable") continue;
      const a = candidateMetric(current, key, metric);
      const b = candidateMetric(exam, key, metric);
      if (a && b && canCompareMetric(a, b, metric)) count += 1;
    }
    if (count >= 2) return metric;
  }
  return "score";
}

export function trajectorySeries(exams = [], key = null, preferred = "auto") {
  const ordered = subjectObservationExams(exams, key);
  const current = ordered[0];
  if (!current) return { metric: "score", rows: [], skipped: [], comparableCount: 0 };
  const metric = chooseTrajectoryMetric(ordered, key, preferred);
  const rows = [];
  const skipped = [];
  for (const exam of ordered) {
    const eligibility = comparisonEligibility(current, exam);
    if (exam.id !== current.id && eligibility.status !== "comparable") {
      skipped.push({ id: exam.id, reason: eligibility.reason });
      continue;
    }
    const value = candidateMetric(exam, key, metric);
    if (!value) {
      skipped.push({ id: exam.id, reason: "该场考试的数据不足，暂时不比较" });
      continue;
    }
    rows.push({ exam, ...value });
  }
  return { metric, rows: rows.reverse(), skipped, comparableCount: rows.length };
}

function direction(first, current) {
  if (!first || !current) return "insufficient";
  const delta = current.directionValue - first.directionValue;
  const threshold = current.kind === "score" ? 1 : current.kind === "percentile" ? 0.5 : 0;
  if (delta > threshold) return "forward";
  if (delta < -threshold) return "backward";
  return "steady";
}

function recentDirection(rows) {
  if (rows.length < 2) return "insufficient";
  return direction(rows[rows.length - 2], rows[rows.length - 1]);
}

function spread(rows) {
  if (!rows.length) return null;
  const values = rows.map(row => row.value);
  return Math.max(...values) - Math.min(...values);
}

function stability(rows) {
  if (rows.length < 3) return { label: "记录还少", detail: `目前只有 ${rows.length} 次可以直接比较的考试` };
  const current = rows[rows.length - 1];
  const range = spread(rows);
  if (current.kind === "percentile") {
    if (range <= 6) return { label: "比较稳定", detail: `最近 ${rows.length} 次都在前后 ${range.toFixed(1).replace(/\\.0$/, "")} 个百分点范围内` };
    if (range <= 10) return { label: "有一定波动", detail: `最近 ${rows.length} 次相差约 ${range.toFixed(1).replace(/\\.0$/, "")} 个百分点` };
    return { label: "波动较大", detail: `最近 ${rows.length} 次相差约 ${range.toFixed(1).replace(/\\.0$/, "")} 个百分点` };
  }
  if (current.kind === "score") {
    if (range <= 3) return { label: "比较稳定", detail: `最近 ${rows.length} 次最高与最低相差 ${range} 分` };
    if (range <= 8) return { label: "有一定波动", detail: `最近 ${rows.length} 次最高与最低相差 ${range} 分` };
    return { label: "波动较大", detail: `最近 ${rows.length} 次最高与最低相差 ${range} 分` };
  }
  if (range <= 5) return { label: "比较稳定", detail: `最近 ${rows.length} 次排名变化较小` };
  if (range <= 15) return { label: "有一定波动", detail: `最近 ${rows.length} 次名次相差 ${range} 名` };
  return { label: "波动较大", detail: `最近 ${rows.length} 次名次相差 ${range} 名` };
}

function observationText(metric, row) {
  return row?.display || "";
}

export function trajectoryAnalysis(exams = [], key = null, preferred = "auto") {
  const full = trajectorySeries(exams, key, preferred);
  const recent = full.rows.slice(-RECENT_WINDOW);
  const current = recent.at(-1) || null;
  const previous = recent.at(-2) || null;
  const first = full.rows[0] || null;
  const stable = stability(recent);
  const currentDirection = recentDirection(recent);
  return {
    metric: full.metric,
    rows: full.rows,
    recent,
    skipped: full.skipped,
    comparableCount: full.comparableCount,
    current: current ? { display: observationText(full.metric, current), value: current.value, kind: current.kind, examId: current.exam.id } : null,
    previous: previous ? { display: observationText(full.metric, previous), value: previous.value, examId: previous.exam.id } : null,
    baseline: first ? { display: observationText(full.metric, first), value: first.value, examId: first.exam.id } : null,
    direction: currentDirection,
    longDirection: direction(first, current),
    stability: stable,
    recentRange: spread(recent),
    coverage: {
      observed: full.rows.length,
      available: recent.length,
      skipped: full.skipped.length
    }
  };
}

export function changeDrivers(exams = [], preferred = "auto") {
  const current = sortExamsChronologically(exams)[0];
  if (!current) return [];
  return SUBJECT_KEYS.map(key => {
    const analysis = trajectoryAnalysis(exams, key, preferred);
    const previous = analysis.previous;
    const currentRow = analysis.current;
    if (!currentRow || !previous) return null;
    const metric = metricBetween(current, analysis.rows.length > 1 ? analysis.rows.at(-2).exam : null, key, analysis.metric);
    if (!metric) return null;
    return { key, metric, analysis };
  }).filter(Boolean).sort((a, b) => Math.abs(b.metric.delta) - Math.abs(a.metric.delta));
}
