import { brandMark } from "./brand-logo-b.js";
import {
  comparisonStrengthLabel,
  findComparableExam as coreFindComparableExam,
  findComparableExamForSubject as coreFindComparableExamForSubject,
  sortExamsChronologically,
  examScoreSummary,
  scoreSummaryText,
  subjectScore,
  formatComparisonSummary,
  resolveDisplayMetric,
  shareBehaviorLabel,
  subjectKeysForDisplay,
  examScoreLabel,
  subjectObservationExams,
  metricBetween as canonicalMetricBetween,
  scoreDeltaParts,
  shouldShowScoreDelta,
  scoreChangeSentence,
  scoreChangeDetail
} from "./domain-v001.js";
import { PUBLIC_VIEW_LABELS, PUBLIC_SUBJECT_OVERVIEW_LABEL } from "./product-contract.js";

const PRODUCT_NAME = "我的高三";
const SUBJECTS = [
  ["chinese", "语文", 150],
  ["math", "数学", 150],
  ["english", "英语", 150],
  ["physics", "物理", 100],
  ["chemistry", "化学", 100],
  ["biology", "生物", 100]
];
const EXAM_TYPES = {
  weekly: "周测",
  monthly: "月考",
  midterm: "期中",
  final: "期末",
  school: "校考",
  joint: "联考",
  mock1: "一模",
  mock2: "二模",
  mock3: "三模",
  other: "其他"
};
const app = document.querySelector("#app");

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function examTypeLabel(type) {
  return EXAM_TYPES[type] || "其他";
}

function fmtNumber(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function rankByScope(rankings, scope) {
  return (rankings || []).find((item) => item?.scope === scope && (item.rank != null || item.participants != null)) || null;
}

function scoreOf(subject) {
  return subjectScore(subject);
}

function overallScore(exam) {
  return examScoreSummary(exam).value;
}

function overallRank(exam, scope) {
  return rankByScope(exam?.overall?.rankings || exam?.overallRankings, scope);
}

function subjectRank(exam, key, scope) {
  return rankByScope(exam?.subjects?.[key]?.rankings, scope);
}

function directionText(metric) {
  if (!metric) return "暂时没有可以直接比较的考试";
  const threshold = metric.kind === "percentile" ? 0.4 : metric.kind === "score" ? 1 : 0;
  if (metric.delta > threshold) {
    if (metric.kind === "score") return `分数高 ${fmtNumber(metric.delta)} 分`;
    if (metric.kind === "percentile") return `校内前 ${fmtNumber(metric.currentValue)}%（上一次校内前 ${fmtNumber(metric.previousValue)}%）`;
    if (metric.kind === "school-rank") return `校内第 ${metric.currentValue} 名（上一次第 ${metric.previousValue} 名）`;
    if (metric.kind === "class-rank") return `班级第 ${metric.currentValue} 名（上一次第 ${metric.previousValue} 名）`;
  }
  if (metric.delta < -threshold) {
    if (metric.kind === "score") return `分数低 ${fmtNumber(Math.abs(metric.delta))} 分`;
    if (metric.kind === "percentile") return `校内前 ${fmtNumber(metric.currentValue)}%（上一次校内前 ${fmtNumber(metric.previousValue)}%）`;
    if (metric.kind === "school-rank") return `校内第 ${metric.currentValue} 名（上一次第 ${metric.previousValue} 名）`;
    if (metric.kind === "class-rank") return `班级第 ${metric.currentValue} 名（上一次第 ${metric.previousValue} 名）`;
  }
  if (metric.kind === "percentile") return `校内前 ${fmtNumber(metric.currentValue)}%（和上一次接近）`;
  if (metric.kind === "school-rank") return `校内第 ${metric.currentValue} 名（和上一次接近）`;
  if (metric.kind === "class-rank") return `班级第 ${metric.currentValue} 名（和上一次接近）`;
  return "和上一次基本接近";
}

function subjectMetricValue(exam, key, metric) {
  const subject = exam?.subjects?.[key] || {};
  const score = scoreOf(subject);
  const school = subjectRank(exam, key, "school");
  const clazz = subjectRank(exam, key, "class");
  if (metric === "auto") {
    if (score != null) return `${fmtNumber(score)} 分`;
    const schoolPct = percentile(school?.rank, school?.participants);
    if (schoolPct != null) return `校内前 ${fmtNumber(schoolPct)}%`;
    if (school?.rank != null) return `校内第 ${school.rank} 名`;
    if (clazz?.rank != null) return `班级第 ${clazz.rank} 名`;
    return null;
  }
  if (metric === "score") return score == null ? null : `${fmtNumber(score)} 分`;
  const ranking = metric === "schoolRank" ? school : clazz;
  if (ranking?.rank == null) return null;
  return `${metric === "schoolRank" ? "校内" : "班级"}第 ${ranking.rank} 名`;
}

function examSituationText(exam) {
  if (!exam) return "";
  if (exam.attendance === "absent" || exam.status === "absent") return "缺考";
  if (exam.condition === "special" || ["good", "poor"].includes(exam.status)) return "有特殊情况";
  return "正常参加";
}

function examComparisonContextText(exam) {
  const comparison = exam?.comparison || {};
  const levelLabels = { school: "校内", alliance: "校际 / 联盟", district: "区县", city: "市级", province: "省级", other: "其他" };
  const parts = [];
  if (comparison.series) parts.push(`考试系列：${comparison.series}`);
  if (comparison.level) parts.push(`比较范围：${levelLabels[comparison.level] || comparison.level}`);
  return parts.join(" · ");
}

function rankingDetails(rankings = []) {
  return rankings.filter((item) => item?.rank != null).map((item) => {
    const scope = item.scope === "school" ? "校内" : item.scope === "class" ? "班级" : item.scope === "joint" ? "联考" : item.scope || "范围";
    const custom = item.label && !["学校", "班级", "联考"].includes(item.label) ? item.label : scope;
    const participants = item.participants != null ? ` / ${item.participants} 人` : "";
    return `${custom}第 ${item.rank} 名${participants}`;
  }).join(" · ");
}

function renderScoreChange(metric) {
  if (!shouldShowScoreDelta(metric)) return "";
  const parts = scoreDeltaParts(metric);
  return `<span class="score-change score-change-${parts.direction}" title="${esc(scoreChangeDetail(metric))}">${esc(parts.compact)}</span>`;
}

function validSubjectKey(value) {
  return SUBJECTS.some(([key]) => key === value) ? value : null;
}

function percentile(rank, participants) {
  if (!Number.isInteger(rank) || !Number.isInteger(participants) || rank < 1 || participants < rank) return null;
  return Math.round((rank / participants) * 1000) / 10;
}

function metricBetween(latest, previous, key = null, metric = "auto") {
  return canonicalMetricBetween(latest, previous, key, metric);
}

function publicSubjectRows(exam, share = {}, exams = []) {
  if (!exam?.subjects) return "";
  const scoreShared = share.fields?.subjectScores === true;
  const rankShared = share.fields?.subjectRanks === true;
  return SUBJECTS.filter(([key]) => subjectKeysForDisplay(exam).includes(key)).map(([key, label]) => {
    const subject = exam.subjects[key] || {};
    const score = scoreShared ? scoreOf(subject) : null;
    const school = rankShared ? rankByScope(subject.rankings, "school") : null;
    const clazz = rankShared ? rankByScope(subject.rankings, "class") : null;
    const meta = [school?.rank != null ? `校内第 ${school.rank}` : null, clazz?.rank != null ? `班级第 ${clazz.rank}` : null].filter(Boolean).join(" · ");
    const previousResult = scoreShared && exams.length > 1 ? coreFindComparableExamForSubject(exams, exam, key, "score") : null;
    const previous = previousResult?.status === "comparable" ? previousResult.reference : null;
    const scoreMetric = previous ? metricBetween(exam, previous, key, "score") : null;
    const change = scoreMetric && shouldShowScoreDelta(scoreMetric) ? scoreChangeSentence(scoreMetric) : "";
    const scoreText = scoreShared ? (score == null ? "" : fmtNumber(score)) : "未分享";
    const rankText = rankShared ? meta : "未分享";
    return `<div class="subject-row"><strong>${label}</strong><b>${esc(scoreText)}</b><span class="subject-row-meta">${esc(rankText)}${change ? `<small class="score-change-inline">${esc(change)}</small>` : ""}</span></div>`;
  }).join("");
}

function publicOverallHistoryCoordinate(exam, share = {}) {
  const projected = { ...exam, overall: { rankings: exam.overallRankings || [] }, overallScore: exam.overallScore };
  const score = share.fields?.overallScore === true && overallScore(projected) != null ? `${fmtNumber(overallScore(projected))} 分` : "";
  const school = share.fields?.overallRank === true ? overallRank(projected, "school") : null;
  const clazz = share.fields?.overallRank === true ? overallRank(projected, "class") : null;
  const joint = share.fields?.overallRank === true ? overallRank(projected, "joint") : null;
  return [score, school?.rank != null ? `校内第 ${school.rank} 名` : "", clazz?.rank != null ? `班级第 ${clazz.rank} 名` : "", joint?.rank != null ? `联考第 ${joint.rank} 名` : ""].filter(Boolean);
}

function publicHistory(exams, share = {}) {
  if (share.fields?.history !== true || !Array.isArray(exams) || exams.length < 2) return "";
  return `<section class="public-history"><div class="section-label">${PUBLIC_VIEW_LABELS.timeline}</div><h2>每一场考试都保留在这里</h2><div class="history-list">${exams.map((exam, index) => {
    const items = publicOverallHistoryCoordinate(exam, share);
    return `<a class="history-row ${index === 0 ? "is-latest" : ""}" href="?view=timeline&exam=${encodeURIComponent(exam.id)}"><span><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}${index === 0 ? " · 最近一次考试" : ""}</small></span><div class="history-coordinate">${items.map((item) => `<span>${esc(item)}</span>`).join("")}</div><span class="row-chevron" aria-hidden="true">›</span></a>`;
  }).join("")}</div><p class="muted">每一场只显示这场考试自己分享的成绩和排名。</p></section>`;
}

function publicViewNavV080(active = "total", subject = null) {
  const suffix = subject ? `&subject=${encodeURIComponent(subject)}` : "";
  const items = [["total", PUBLIC_VIEW_LABELS.total, ""], ["subject", PUBLIC_VIEW_LABELS.subject, suffix], ["timeline", PUBLIC_VIEW_LABELS.timeline, ""]];
  return `<nav class="public-view-nav" aria-label="分享视图">${items.map(([key, label, itemSuffix]) => `<a class="public-view-tab ${active === key ? "active" : ""}" href="?view=${key}${itemSuffix}" aria-current="${active === key ? "page" : "false"}">${label}</a>`).join("")}</nav>`;
}

function publicBaselineV081(view, exams, share = {}) {
  if (!Array.isArray(exams) || exams.length !== 1) return "";
  const behavior = shareBehaviorLabel(share);
  const scopeText = share.scope === "trajectory" ? "目前记录到这里" : "这次考试";
  return `<aside class="public-baseline-note" aria-label="记录状态"><span class="public-baseline-mark" aria-hidden="true"></span><div><strong>目前的记录</strong><small>${scopeText}</small><p>${share.scope === "trajectory" ? "现在只记录到这一场考试。" : "分享只包含这一场考试。"}${behavior}。</p></div></aside>`;
}

function publicComparisonNote(exams, key = null, share = {}) {
  if (share.fields?.history !== true || exams.length < 2) return "";
  const ordered = sortExamsChronologically(exams);
  const current = ordered[0] || null;
  const effectiveMetric = key && current ? resolveDisplayMetric(current, key, "auto") : (!key && current ? resolveDisplayMetric(current, null, "auto") : "score");
  const comparison = key
    ? coreFindComparableExamForSubject(subjectObservationExams(ordered, key), current, key, effectiveMetric)
    : coreFindComparableExam(ordered, current);
  const previous = comparison.status === "comparable" ? comparison.reference : null;
  const summary = formatComparisonSummary({
    hasHistory: true,
    comparable: Boolean(previous),
    reason: comparison.reason,
    previousDate: previous ? fmtDate(previous.date) : "",
    historyCount: Math.max(0, exams.length - 1)
  });
  if (!previous) {
    return `<aside class="public-comparison-note"><div class="section-label">和以前相比</div><strong>${esc(summary.title)}</strong>${summary.detail ? `<p>${esc(summary.detail)}</p>` : ""}</aside>`;
  }
  const metric = key ? comparison.metric : metricBetween(current, previous, null, resolveDisplayMetric(current, null, "auto"));
  const strength = comparisonStrengthLabel(comparison);
  return `<aside class="public-comparison-note"><div class="section-label">和以前相比</div><strong>${esc(directionText(metric))}</strong><p>${esc(strength)} · ${esc(summary.detail)}</p></aside>`;
}

function publicSubjectComparisonV080(exams, key, share = {}) {
  const ordered = sortExamsChronologically(exams);
  const picker = `<div class="subject-picker public-subject-picker"><a class="subject-chip ${key == null ? "active" : ""}" href="?view=subject" aria-current="${key == null ? "page" : "false"}">全部科目</a>${SUBJECTS.map(([subject, label]) => `<a class="subject-chip ${subject === key ? "active" : ""}" href="?view=subject&subject=${encodeURIComponent(subject)}" aria-current="${subject === key ? "page" : "false"}">${label}</a>`).join("")}</div>`;
  if (key == null) {
    const latest = ordered[0] || null;
    return `<section class="public-reading-section"><div class="section-label">${PUBLIC_VIEW_LABELS.subject}</div><h2>${PUBLIC_SUBJECT_OVERVIEW_LABEL}</h2>${publicBaselineV081("subject", ordered, share)}${picker}${latest ? `<div class="subject-rows public-subjects">${publicSubjectRows(latest, share)}</div>` : `<p class="muted">还没有可分享的考试数据。</p>`}</section>`;
  }

  const label = SUBJECTS.find(([subject]) => subject === key)?.[1] || "单科";
  const subjectExams = subjectObservationExams(ordered, key);
  const current = subjectExams[0] || null;
  const effectiveMetric = current ? resolveDisplayMetric(current, key, "auto") : "score";
  const comparison = coreFindComparableExamForSubject(subjectExams, current, key, effectiveMetric);
  const change = comparison.status === "comparable" ? comparison.metric : null;
  const currentValue = current ? subjectMetricValue(current, key, "score") || subjectMetricValue(current, key, effectiveMetric) : "";
  const compareText = change
    ? `和 ${fmtDate(comparison.reference.date)} 相比`
    : formatComparisonSummary({
        hasHistory: subjectExams.length > 1,
        comparable: false,
        reason: comparison.reason,
        historyCount: Math.max(0, subjectExams.length - 1)
      }).title;

  const rows = subjectExams.map((exam, index) => {
    const subject = exam.subjects?.[key] || {};
    const score = share.fields?.subjectScores !== true ? null : scoreOf(subject);
    const school = share.fields?.subjectRanks !== true ? null : rankByScope(subject.rankings, "school");
    const clazz = share.fields?.subjectRanks !== true ? null : rankByScope(subject.rankings, "class");
    const values = [score == null ? null : `${fmtNumber(score)} 分`, school?.rank != null ? `校内第 ${school.rank}` : null, clazz?.rank != null ? `班级第 ${clazz.rank}` : null].filter(Boolean).join(" · ");
    return `<div class="subject-compare-row ${index === 0 ? "is-latest" : ""}"><div><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}${index === 0 ? " · 最近一次有记录的成绩" : ""}</small></div><b>${esc(values || "未分享")}</b></div>`;
  }).join("");

  const changeBlock = current ? `<div class="subject-focus-fact"><strong>${esc(currentValue)}</strong></div><div class="comparison-state" role="status"><strong>${esc(change ? directionText(change) : compareText)}</strong><span>${esc(change ? change.detail + " · " + compareText : compareText)}</span></div>` : `<div class="empty compact">还没有可分享的${esc(label)}成绩。</div>`;

  return `<section class="public-reading-section public-subject-comparison"><div class="section-label">单科</div><h2>${label}的历次记录</h2>${publicBaselineV081("subject", subjectExams, share)}${picker}${changeBlock}${rows ? `<div class="subject-compare-list">${rows}</div>` : `<p class="muted">还没有可分享的${label}记录。</p>`}<p class="muted subject-history-scope">这里只列出实际记录过${label}成绩的考试；没有记录这门课的考试不会出现在这里。</p></section>`;
}

function publicExamDetailV080(exam, share = {}, exams = []) {
  if (!exam) return "";
  const scoreShared = share.fields?.subjectScores === true;
  const rankShared = share.fields?.subjectRanks === true;
  const overallPreviousResult = share.fields?.overallScore === true && exams.length > 1 ? coreFindComparableExam(exams, exam) : null;
  const overallPrevious = overallPreviousResult?.status === "comparable" ? overallPreviousResult.reference : null;
  const overallScoreMetric = overallPrevious ? metricBetween(exam, overallPrevious, null, "score") : null;
  const rows = SUBJECTS.filter(([key]) => subjectKeysForDisplay(exam).includes(key)).map(([key, label]) => {
    const subject = exam.subjects?.[key] || {};
    const score = scoreShared ? scoreOf(subject) : null;
    const school = rankShared ? rankByScope(subject.rankings, "school") : null;
    const clazz = rankShared ? rankByScope(subject.rankings, "class") : null;
    const values = [score == null ? null : `${fmtNumber(score)} 分`, subject.fullScore ? `满分 ${subject.fullScore}` : null, school?.rank != null ? `校内第 ${school.rank}` : null, clazz?.rank != null ? `班级第 ${clazz.rank}` : null].filter(Boolean).join(" · ");
    const previousResult = scoreShared && exams.length > 1 ? coreFindComparableExamForSubject(exams, exam, key, "score") : null;
    const previous = previousResult?.status === "comparable" ? previousResult.reference : null;
    const scoreMetric = previous ? metricBetween(exam, previous, key, "score") : null;
    const change = scoreMetric && shouldShowScoreDelta(scoreMetric) ? scoreChangeSentence(scoreMetric) : "";
    const display = !scoreShared && !rankShared ? "未分享" : [values, change].filter(Boolean).join(" · ");
    return `<div class="exam-detail-subject"><strong>${label}</strong><span>${esc(display)}</span></div>`;
  }).join("");
  const summary = examScoreSummary(exam);
  const situation = share.fields?.examStatus === true ? examSituationText(exam) : "";
  const contextText = share.fields?.comparisonContext === true ? examComparisonContextText(exam) : "";
  const scoreLabel = examScoreLabel(exam, summary);
  const scoreText = share.fields?.overallScore !== true ? `${scoreLabel || "成绩"}未分享` : (summary.kind === "missing" ? "" : scoreSummaryText(summary));
  const rankText = share.fields?.overallRank !== true ? "" : rankingDetails(exam.overallRankings || []);
  const overall = [scoreText, rankText].filter(Boolean).join(" · ");
  const change = share.fields?.overallScore === true ? renderScoreChange(overallScoreMetric) : "";
  const optionalMeta = [situation, contextText].filter(Boolean).join(" · ");
  return `<section class="public-reading-section public-exam-detail"><div class="section-label">考试详情</div><h2>${esc(exam.name)}</h2><p>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}${optionalMeta ? ` · ${esc(optionalMeta)}` : ""}</p><div class="exam-detail-overall"><strong>${esc(overall)}</strong>${change}</div><div class="exam-detail-subjects">${rows}</div></section>`;
}

function publicTimelineV080(exams, selectedExamId = null, share = {}) {
  const ordered = sortExamsChronologically(exams);
  const selected = ordered.find((exam) => exam.id === selectedExamId) || null;
  const rows = ordered.map((exam, index) => {
    const coordinateItems = publicOverallHistoryCoordinate(exam, share);
    const previousResult = share.fields?.overallScore === true && ordered.length > 1 ? coreFindComparableExam(ordered, exam) : null;
    const previous = previousResult?.status === "comparable" ? previousResult.reference : null;
    const scoreMetric = previous ? metricBetween(exam, previous, null, "score") : null;
    return `<a class="history-row ${index === 0 ? "is-latest" : ""}" href="?view=timeline&exam=${encodeURIComponent(exam.id)}"><span><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}${index === 0 ? " · 最近一次考试" : ""}</small></span><div class="history-coordinate">${coordinateItems.map((item) => `<span>${esc(item)}</span>`).join("")}${renderScoreChange(scoreMetric)}</div><span class="row-chevron" aria-hidden="true">›</span></a>`;
  }).join("");
  return `<section class="public-reading-section public-timeline"><div class="section-label">历次考试</div><h2>每一次考试都可以打开</h2>${publicBaselineV081("timeline", ordered, share)}${selected ? publicExamDetailV080(selected, share, ordered) : ""}<div class="history-list">${rows || `<div class="empty compact">暂未分享考试数据。</div>`}</div><p class="muted">页面只显示你选择分享的内容。</p></section>`;
}

function renderPublicV080(result) {
  const data = result.data || {};
  app.classList.add("share-eink-root");
  const params = new URLSearchParams(location.search);
  const view = ["total", "subject", "timeline"].includes(params.get("view")) ? params.get("view") : "total";
  const subject = validSubjectKey(params.get("subject"));
  const selectedExamId = params.get("exam") || null;
  const exams = sortExamsChronologically(data.exams || []);
  const latest = exams[0] || null;
  const school = rankByScope(latest?.overallRankings, "school");
  const clazz = rankByScope(latest?.overallRankings, "class");
  const latestSummary = examScoreSummary(latest);
  const totalText = scoreSummaryText(latestSummary);
  const coordinate = latest ? [result.share.fields?.overallRank !== true ? null : school?.rank != null ? `校内第 ${school.rank} 名` : null, result.share.fields?.overallRank !== true ? null : clazz?.rank != null ? `班级第 ${clazz.rank} 名` : null, result.share.fields?.overallScore !== true ? null : totalText].filter(Boolean) : [];
  const coordinateText = coordinate.length ? coordinate.map((item) => `<span>${esc(item)}</span>`).join("") : `<span>成绩与排名未分享</span>`;
  const meta = [data.student?.graduationYear ? `${data.student.graduationYear}届` : null, data.student?.schoolLabel, data.student?.className].filter(Boolean).map(esc).join(" · ");
  const total = `<section class="public-coordinate"><div class="public-mode">${esc(shareBehaviorLabel(result.share))}</div><h1>${esc(data.student?.displayName || "学生")}</h1><p>${meta}</p>${latest ? `<div class="exam-context"><strong>${esc(latest.name)}</strong><span>${fmtDate(latest.date)} · ${examTypeLabel(latest.type)}</span></div><div class="coordinate-row">${coordinateText}</div>${publicBaselineV081("total", exams, result.share)}${publicComparisonNote(exams, null, result.share)}${result.share.fields?.overallScore === true && exams.length > 1 ? (() => { const previousResult = coreFindComparableExam(exams, latest); const previous = previousResult.status === "comparable" ? previousResult.reference : null; const metric = previous ? metricBetween(latest, previous, null, "score") : null; return metric && shouldShowScoreDelta(metric) ? `<div class="public-score-change"><strong>${esc(scoreChangeSentence(metric))}</strong><small>${esc(scoreChangeDetail(metric))}</small></div>` : ""; })() : ""}<div class="subject-rows public-subjects">${publicSubjectRows(latest, result.share, exams)}</div>${publicHistory(exams, result.share)}` : `<div class="empty compact">暂未分享考试数据。</div>`}</section>`;
  const body = view === "subject" ? publicSubjectComparisonV080(exams, subject, result.share) : view === "timeline" ? publicTimelineV080(exams, selectedExamId, result.share) : total;
  app.innerHTML = `<main class="public-shell eink-share" data-share-view="${view}" data-exam-count="${exams.length}"><div class="public-brand">${brandMark()}<span>${PRODUCT_NAME} · 分享</span></div><div class="privacy-note">这是家庭主动分享的内容，请不要随意转发</div>${publicViewNavV080(view, subject)}${body}</main><footer class="footer">需要时可以随时撤销分享</footer>`;
}

async function shareApi(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `请求失败 (${response.status})`);
    error.status = response.status;
    error.code = payload.error;
    throw error;
  }
  return payload;
}

async function renderExternal(kind, locator) {
  try {
    let result;
    if (kind === "secret" && !locator) {
      const token = decodeURIComponent(String(location.hash || "").replace(/^#/, ""));
      if (!token) throw new Error("分享链接无效");
      result = await shareApi("/api/share/secret/redeem", {
        method: "POST",
        body: JSON.stringify({ token })
      });
      history.replaceState(null, "", location.pathname + location.search);
    } else {
      result = await shareApi(`/api/share/${kind}/${encodeURIComponent(locator)}`);
    }
    renderPublicV080(result);
  } catch (error) {
    app.innerHTML = `<main class="login-shell"><section class="login-card">${brandMark()}<h1>分享已失效</h1><p>${esc(error.message)}</p></section></main>`;
  }
}

async function bootstrapShare() {
  const path = location.pathname;
  if (path.startsWith("/share/")) return renderExternal("secret", path.slice("/share/".length));
  if (path.startsWith("/p/")) return renderExternal("public", path.slice("/p/".length));
  app.innerHTML = `<main class="login-shell"><section class="login-card">${brandMark()}<h1>分享已失效</h1><p>分享地址无效</p></section></main>`;
}

bootstrapShare();
