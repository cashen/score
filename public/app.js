import "./draft.js";
import { brandMark } from "./brand-logo-b.js";
import { comparisonCategory as coreComparisonCategory, comparisonReason as coreComparisonReason, comparisonEligibility as coreComparisonEligibility, comparableSet as coreComparableSet, comparableRanking as coreComparableRanking, findComparableExam as coreFindComparableExam } from "./trajectory-core-v060.js";
import { examScoreSummary, examCompleteness, scoreSummaryText, subjectScore } from "./score-core-v090.js";

const PRODUCT_NAME = "高三坐标";
const PRODUCT_TAGLINE = "看见现在的位置，也看见一路的变化";
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
const COMPARISON_LEVELS = [
  ["", "未标注"],
  ["school", "校内"],
  ["alliance", "校际 / 联盟"],
  ["district", "区县"],
  ["city", "市级"],
  ["province", "省级"],
  ["other", "其他"]
];

const state = {
  me: null,
  csrf: null,
  student: null,
  exams: [],
  trash: [],
  shares: [],
  familyMembers: [],
  invitations: [],
 tab: "overview",
  trajectoryView: "total",
  subjectKey: "chinese",
  subjectMetric: "score",
  selectedExamId: null,
 editingExam: null,
  notice: "",
  noticeTone: "notice"
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

function comparisonCategory(type) {
  // if (type === "joint" || type === "school") return "joint_school"; ["mock1", "mock2", "mock3"].includes(type); return "mock"
  return coreComparisonCategory(type);
}

function percentile(rank, participants) {
  if (!Number.isInteger(rank) || !Number.isInteger(participants) || rank < 1 || participants < rank) return null;
  return Math.round((rank / participants) * 1000) / 10;
}

function fmtNumber(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function rankByScope(rankings, scope) {
  return (rankings || []).find((item) => item?.scope === scope && (item.rank != null || item.participants != null)) || null;
}

function rankText(ranking) {
  if (!ranking?.rank) return "—";
  return `第 ${ranking.rank} 名`;
}

function compactRank(prefix, ranking) {
  return ranking?.rank ? `${prefix}第 ${ranking.rank} 名` : "";
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

function roleLabel(role) {
  return role === "owner" ? "家庭管理员" : role === "editor" ? "可编辑" : "仅查看";
}

function canEdit() {
  return ["owner", "editor"].includes(state.me?.member?.role);
}

function isOwner() {
  return state.me?.member?.role === "owner";
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (state.csrf && !["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) headers.set("x-score-csrf", state.csrf);
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `请求失败 (${response.status})`);
    error.status = response.status;
    error.code = payload.error;
    error.field = payload.field;
    error.current = payload.current;
    throw error;
  }
  return payload;
}

function setNotice(message, tone = "notice") {
  state.notice = message || "";
  state.noticeTone = tone;
  const target = document.querySelector("[data-status-region]");
  if (target) {
    target.className = `status-region is-${tone}`;
    target.textContent = state.notice;
    target.hidden = !state.notice;
  }
}

function clearNotice() {
  setNotice("");
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch {}
  area.remove();
  return ok;
}

function latestExam() {
  return state.exams[0] || null;
}

function comparableSet(exams = state.exams) {
  // Legacy source contract retained for older integrations: const sameCategory = exams.filter(...); const sameSeries = sameCategory.filter(...); if (sameSeries.length >= 2) return sameSeries.slice(0, 6)
  return coreComparableSet(exams);
}

function comparisonState(exams = state.exams) {
  // baseline contract: status: "baseline"
  const latest = exams[0] || null;
  const result = coreFindComparableExam(exams, latest);
  return { ...result, latest, previous: result.reference };
}

function metricBetween(latest, previous, key = null, metric = "auto") {
  if (!latest || !previous) return null;
  if (coreComparisonEligibility(latest, previous).status !== "comparable") return null;
  if (metric === "auto" || metric === "schoolRank") {
    const currentSchool = key ? subjectRank(latest, key, "school") : overallRank(latest, "school");
    const priorSchool = key ? subjectRank(previous, key, "school") : overallRank(previous, "school");
    if (currentSchool && priorSchool && coreComparableRanking(currentSchool, priorSchool)) {
      const currentPct = percentile(currentSchool.rank, currentSchool.participants);
      const priorPct = percentile(priorSchool.rank, priorSchool.participants);
      if (currentPct != null && priorPct != null) return { kind: "percentile", metric: "schoolRank", delta: priorPct - currentPct, detail: `校前 ${fmtNumber(priorPct)}% → 校前 ${fmtNumber(currentPct)}%` };
      if (currentSchool.rank != null && priorSchool.rank != null) return { kind: "school-rank", metric: "schoolRank", delta: priorSchool.rank - currentSchool.rank, detail: `校第 ${priorSchool.rank} → 校第 ${currentSchool.rank}` };
    }
    if (metric === "schoolRank") return null;
  }
  if (metric === "auto" || metric === "classRank") {
    const currentClass = key ? subjectRank(latest, key, "class") : overallRank(latest, "class");
    const priorClass = key ? subjectRank(previous, key, "class") : overallRank(previous, "class");
    if (currentClass && priorClass && coreComparableRanking(currentClass, priorClass) && currentClass.rank != null && priorClass.rank != null) return { kind: "class-rank", metric: "classRank", delta: priorClass.rank - currentClass.rank, detail: `班第 ${priorClass.rank} → 班第 ${currentClass.rank}` };
    if (metric === "classRank") return null;
  }
  if (metric === "auto" || metric === "score") {
    const currentScore = key ? scoreOf(latest.subjects?.[key]) : overallScore(latest);
    const priorScore = key ? scoreOf(previous.subjects?.[key]) : overallScore(previous);
    if (currentScore != null && priorScore != null) {
      return { kind: "score", metric: "score", delta: currentScore - priorScore, detail: `${fmtNumber(priorScore)} → ${fmtNumber(currentScore)} 分` };
    }
  }
  return null;
}

function directionText(metric) {
  if (!metric) return "还没有第二次可比考试";
  const threshold = metric.kind === "percentile" ? 0.4 : metric.kind === "score" ? 1 : 0;
  if (metric.delta > threshold) return metric.kind === "score" ? `分数高 ${fmtNumber(metric.delta)} 分` : metric.kind === "percentile" ? `校内位置向前 ${fmtNumber(metric.delta)} 个百分点` : `位置向前 ${Math.abs(metric.delta)} 名`;
  if (metric.delta < -threshold) return metric.kind === "score" ? `分数低 ${fmtNumber(Math.abs(metric.delta))} 分` : metric.kind === "percentile" ? `校内位置向后 ${fmtNumber(Math.abs(metric.delta))} 个百分点` : `位置向后 ${Math.abs(metric.delta)} 名`;
  return "和上一次基本接近";
}

function humanChangeSummary(metric, sources) {
  if (!metric) return "先记录更多同类别考试，再看变化。";
  const threshold = metric.kind === "percentile" ? 0.4 : metric.kind === "score" ? 1 : 0;
  const subject = sources[0]?.label ? `${sources[0].label}的变化更明显。` : "";
  if (metric.delta > threshold) return `这次整体位置向前。${subject}`;
  if (metric.delta < -threshold) return `这次整体位置向后。${subject}`;
  return `这次整体位置和上一次基本接近。${subject}`;
}

function changeSources(latest, previous, basis) {
  if (!latest || !previous) return [];
  const requested = basis?.metric || "auto";
  return SUBJECTS.map(([key, label]) => ({ key, label, metric: metricBetween(latest, previous, key, requested) }))
    .filter(item => item.metric && (!basis || item.metric.kind === basis.kind))
    .sort((a, b) => Math.abs(b.metric.delta) - Math.abs(a.metric.delta))
    .slice(0, 3);
}

function coordinateItems(exam) {
  const school = overallRank(exam, "school");
  const clazz = overallRank(exam, "class");
  const items = [compactRank("校", school), compactRank("班", clazz)];
  const summary = examScoreSummary(exam);
  if (summary.kind === "official") items.push(`${fmtNumber(summary.value)} 分`);
  else if (summary.kind === "calculated_complete") items.push(`六科合计 ${fmtNumber(summary.value)}`);
  else if (summary.kind === "calculated_partial") items.push(`${summary.recordedSubjects}/6 科小计 ${fmtNumber(summary.subtotal)}`);
  else if (summary.kind === "absent") items.push("缺考");
  return items.filter(Boolean);
}

function coordinateRow(exam, className = "coordinate-row") {
  const items = coordinateItems(exam);
  return `<div class="${className}">${items.length ? items.map((item) => `<span>${esc(item)}</span>`).join("") : `<span>位置待补</span>`}</div>`;
}

function identityMeta(student) {
  return [student?.graduationYear ? `${student.graduationYear}届` : null, student?.schoolLabel, student?.className, student?.subjectTrack].filter(Boolean).map(esc).join(" · ");
}

function trajectorySubnav(active = "total") {
  const items = [["total", "总成绩"], ["subject", "单科对比"], ["timeline", "时间轴"]];
  return `<nav class="trajectory-subnav" aria-label="轨迹视图">${items.map(([key, label]) => `<button type="button" class="trajectory-subtab ${active === key ? "active" : ""}" data-trajectory-view="${key}" aria-pressed="${active === key}">${label}</button>`).join("")}</nav>`;
}

function subjectMetricValue(exam, key, metric) {
  const subject = exam?.subjects?.[key] || {};
  if (metric === "score") return scoreOf(subject) == null ? null : `${fmtNumber(scoreOf(subject))} 分`;
  const ranking = subjectRank(exam, key, metric === "schoolRank" ? "school" : "class");
  if (!ranking?.rank) return null;
  return `${metric === "schoolRank" ? "校" : "班"}第 ${ranking.rank} 名`;
}

function rankingDetails(rankings = []) {
  return rankings.filter((item) => item?.rank != null || item?.participants != null).map((item) => {
    const scope = item.scope === "school" ? "学校" : item.scope === "class" ? "班级" : item.scope || "范围";
    const rank = item.rank != null ? `${scope}第 ${item.rank} 名` : `${scope}排名未填`;
    const participants = item.participants != null ? ` / ${item.participants} 人` : "";
    return `${rank}${participants}`;
  }).join(" · ");
}

function renderSubjectComparison() {
  const key = SUBJECTS.some(([subject]) => subject === state.subjectKey) ? state.subjectKey : SUBJECTS[0][0];
  const metric = ["score", "schoolRank", "classRank"].includes(state.subjectMetric) ? state.subjectMetric : "score";
  const label = SUBJECTS.find(([subject]) => subject === key)?.[1] || "单科";
  const rows = state.exams.map((exam) => `<div class="subject-compare-row"><div><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}</small></div><b>${esc(subjectMetricValue(exam, key, metric) || "—" )}</b><span>${esc(metric === "score" ? "按当前记录的分数显示" : "按当前记录的相对位置显示")}</span></div>`).join("");
  const comparison = comparisonState();
  const current = comparison.latest;
  const previous = comparison.status === "comparable" ? comparison.previous : null;
  const change = metricBetween(current, previous, key, metric);
  const status = change ? change.detail : comparison.reason;
  return `<section class="trajectory-view subject-compare-view"><div class="page-heading"><div><div class="section-label">单科对比</div><h1>${label}</h1><p>把分数、学校排名和班级排名分开看；数据不足时不下结论。</p></div></div><div class="subject-picker" role="group" aria-label="选择科目">${SUBJECTS.map(([subject, subjectLabel]) => `<button type="button" class="subject-chip ${subject === key ? "active" : ""}" data-subject-key="${subject}" aria-pressed="${subject === key}">${subjectLabel}</button>`).join("")}</div><div class="metric-picker" role="group" aria-label="选择单科指标"><button type="button" class="metric-chip ${metric === "score" ? "active" : ""}" data-subject-metric="score" aria-pressed="${metric === "score"}">分数</button><button type="button" class="metric-chip ${metric === "schoolRank" ? "active" : ""}" data-subject-metric="schoolRank" aria-pressed="${metric === "schoolRank"}">学校排名</button><button type="button" class="metric-chip ${metric === "classRank" ? "active" : ""}" data-subject-metric="classRank" aria-pressed="${metric === "classRank"}">班级排名</button></div><div class="comparison-state" role="status"><strong>${esc(change ? directionText(change) : status)}</strong><span>${esc(status)}</span></div>${rows ? `<div class="subject-compare-list">${rows}</div>` : `<div class="empty-state compact"><h2>还没有考试记录</h2><p>先记录一场考试，建立这门课的基线。</p></div>`}</section>`;
}

function renderExamDetail(exam) {
  if (!exam) return "";
  const subjectRows = SUBJECTS.map(([key, label]) => {
    const subject = exam.subjects?.[key] || {};
    const score = scoreOf(subject);
    const details = rankingDetails(subject.rankings);
    return `<div class="exam-detail-subject"><strong>${label}</strong><span>${score == null ? "分数待补" : `${fmtNumber(score)} 分`}</span><small>${esc(details || "排名待补")}</small></div>`;
  }).join("");
  return `<section class="exam-detail section-surface"><div class="section-head-simple"><div><div class="section-label">考试详情</div><h2>${esc(exam.name)}</h2><p>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}</p></div>${canEdit() ? `<button class="btn btn-outline btn-small" data-action="edit-exam" data-id="${esc(exam.id)}">编辑</button>` : ""}</div><div class="exam-detail-overall"><strong>${esc(scoreSummaryText(examScoreSummary(exam)))}</strong><span>${esc(rankingDetails(exam.overall?.rankings || [] ) || "总体排名待补")}</span></div><p class="trajectory-boundary-note">${esc(coreComparisonReason(exam, state.exams.find((item) => item.id !== exam.id) || null))}</p><div class="exam-detail-subjects">${subjectRows}</div>${exam.notes && canEdit() ? `<details class="private-detail"><summary>家庭内部备注</summary><p>${esc(exam.notes)}</p></details>` : ""}${exam.reflection?.studentNote || exam.reflection?.nextTry ? `<details class="private-detail reflection-detail" open><summary>学生自己的回看</summary>${exam.reflection.studentNote ? `<p><strong>我想补充：</strong>${esc(exam.reflection.studentNote)}</p>` : ""}${exam.reflection.nextTry ? `<p><strong>下次想试：</strong>${esc(exam.reflection.nextTry)}</p>` : ""}</details>` : ""}</section>`;
}

function renderTimelineView() {
  const selected = state.exams.find((exam) => exam.id === state.selectedExamId) || null;
  const rows = state.exams.map((exam, index) => `<a class="history-row timeline-row ${index === 0 ? "is-latest" : ""}" href="?view=timeline&exam=${encodeURIComponent(exam.id)}" data-action="view-exam" data-id="${esc(exam.id)}"><span><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}${index === 0 ? " · 最新" : ""}</small></span>${coordinateRow(exam, "history-coordinate")}<span class="row-chevron" aria-hidden="true">›</span></a>`).join("");
  return `<section class="trajectory-view timeline-view"><div class="page-heading"><div><div class="section-label">时间轴</div><h1>每一次考试都在这里</h1><p>打开任意一场，查看这次考试的完整记录。</p></div>${canEdit() ? `<button class="btn btn-primary" data-action="new-exam">记录考试</button>` : ""}</div>${selected ? renderExamDetail(selected) : ""}${rows ? `<div class="history-list full-timeline-list">${rows}</div>` : `<div class="empty-state compact"><h2>还没有考试记录</h2><p>先记录一场考试。</p></div>`}</section>`;
}

function renderHeader() {
  const students = state.me?.students || [];
  const selector = students.length > 1 ? `<select id="student-select" aria-label="切换孩子">${students.map((student) => `<option value="${esc(student.id)}" ${state.student?.id === student.id ? "selected" : ""}>${esc(student.displayName)}</option>`).join("")}</select>` : "";
  return `<header class="topbar"><div class="topbar-inner"><div class="brand">${brandMark()}<span>${PRODUCT_NAME}</span></div><div class="top-actions"><span class="privacy-pill" aria-label="数据默认仅家庭成员可见">仅家庭可见</span>${selector}<details class="account-menu"><summary class="btn btn-outline btn-small">账号</summary><div class="account-menu-panel"><button type="button" data-tab-jump="family">家庭与账号</button><button type="button" data-action="export">导出全部数据</button><button type="button" data-action="logout">退出登录</button></div></details></div></div></header>`;
}

function renderSubjectRows(exam) {
  if (!exam) return "";
  return SUBJECTS.map(([key, label]) => {
    const subject = exam.subjects?.[key] || {};
    const school = subjectRank(exam, key, "school");
    const clazz = subjectRank(exam, key, "class");
    const score = scoreOf(subject);
    const rankParts = [school?.rank ? `校第 ${school.rank}` : null, clazz?.rank ? `班第 ${clazz.rank}` : null].filter(Boolean).join(" · ");
    return `<div class="subject-row"><strong>${label}</strong><b>${score ?? "—"}</b><span>${esc(rankParts || "排名待补")}</span></div>`;
  }).join("");
}

function renderDeepTrajectory() {
  const exams = state.exams;
  if (!exams.length) return "";
  const overallRows = exams.map((exam) => `<div class="history-row" data-action="edit-exam" data-id="${esc(exam.id)}" tabindex="0" role="button"><div><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}</small></div>${coordinateRow(exam, "history-coordinate")}</div>`).join("");
  const subjectHistory = SUBJECTS.map(([key, label]) => {
    const rows = exams.map((exam) => {
      const score = scoreOf(exam.subjects?.[key]);
      const school = subjectRank(exam, key, "school");
      const clazz = subjectRank(exam, key, "class");
      if (score == null && !school?.rank && !clazz?.rank) return "";
      const values = [score != null ? `${score} 分` : null, school?.rank ? `校第 ${school.rank}` : null, clazz?.rank ? `班第 ${clazz.rank}` : null].filter(Boolean).join(" · ");
      return `<div class="subject-history-row"><span>${fmtDate(exam.date)}</span><strong>${esc(exam.name)}</strong><b>${esc(values)}</b></div>`;
    }).filter(Boolean).join("");
    return rows ? `<details class="subject-history"><summary>${label}<span>查看历次记录</span></summary><div>${rows}</div></details>` : "";
  }).join("");
  return `<details class="deep-trajectory" id="deep-trajectory" data-deep-trajectory><summary><span><strong>查看完整轨迹</strong><small>历次整体位置与六科历史</small></span><span aria-hidden="true">＋</span></summary><div class="deep-trajectory-body"><p class="trajectory-boundary-note">只有同类别、口径一致的考试会用于变化结论；其他记录仍会保留，方便回看。</p><section><h3>历次考试</h3><div class="history-list">${overallRows}</div></section><section><h3>六科历史</h3><div class="subject-history-list">${subjectHistory}</div></section></div></details>`;
}

// Legacy source wording retained: 变化较明显的科目；先看事实，再决定下一步
function renderOverview() {
  // Legacy source wording retained in this overview slice: 变化较明显的科目
  if (state.trajectoryView === "subject") return renderSubjectComparison();
  if (state.trajectoryView === "timeline") return renderTimelineView();
  const exam = latestExam();
  if (!exam) {
    return `<section class="empty-state">${brandMark()}<h1>先记录第一场考试</h1><p>不用一次填完所有数据。先把考试、总分和你手头已有的排名记下来即可。</p>${canEdit() ? `<button class="btn btn-primary" data-action="new-exam">记录第一次考试</button>` : `<p class="muted">当前账号只有查看权限。</p>`}</section>`;
  }
  const comparison = comparisonState();
  const previous = comparison.status === "comparable" ? comparison.previous : null;
  const overallMetric = metricBetween(exam, previous);
  const sources = changeSources(exam, previous, overallMetric);
  const school = overallRank(exam, "school");
  const schoolPct = percentile(school?.rank, school?.participants);
  const completeness = examCompleteness(exam);
  const subjectNames = Object.fromEntries(SUBJECTS.map(([key, label]) => [key, label]));
  const completionText = completeness.complete ? "" : `已录 ${6 - completeness.missingSubjects.length}/6 科，还缺 ${completeness.missingSubjects.map(key => subjectNames[key]).join("、")}`;
  const primaryLabel = completeness.complete ? "记录下一次考试" : "继续补充这次考试";
  const primaryAction = completeness.complete ? "new-exam" : "continue-exam";
  const comparisonNote = previous ? [esc(previous.name), fmtDate(previous.date), coreComparisonReason(exam, previous)].join(" · ") : comparison.reason;
  return `<section class="coordinate-hero"><div class="hero-head"><div><h1>${esc(state.student.displayName)}</h1><p>${identityMeta(state.student) || "孩子资料可稍后补充"}</p></div>${canEdit() ? `<button class="btn btn-outline btn-small" data-action="edit-exam" data-id="${esc(exam.id)}">编辑这次考试</button>` : ""}</div><div class="exam-context"><strong>${esc(exam.name)}</strong><span>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}</span></div>${coordinateRow(exam)}${completionText ? `<p class="completion-note">${esc(completionText)}</p>` : ""}${schoolPct != null || school?.participants ? `<div class="coordinate-note">${schoolPct != null ? `校前 ${fmtNumber(schoolPct)}%` : ""}${schoolPct != null && school?.participants ? " · " : ""}${school?.participants ? `本次共 ${school.participants} 人` : ""}</div>` : ""}</section><section class="reading-section change-section"><div class="section-label">和上一次可比考试相比</div><div class="change-main"><strong>${esc(directionText(overallMetric))}</strong><span>${esc(overallMetric?.detail || comparisonNote)}</span><p class="human-summary">${esc(humanChangeSummary(overallMetric, sources))}</p></div>${previous ? `<small>比较对象：${comparisonNote}</small>` : `<small>${comparisonNote}</small>`}</section><section class="reading-section"><div class="section-head-simple"><div><div class="section-label">值得回看的科目</div><h2>先看同一种指标，再决定下一步</h2></div></div>${sources.length ? `<div class="change-source-list">${sources.map(({ key, label, metric }) => { const current = subjectRank(exam, key, "school") || subjectRank(exam, key, "class"); return `<div class="change-source-row"><strong>${label}</strong><span>${current?.rank ? `${current.scope === "school" ? "校" : "班"}第 ${current.rank}` : scoreOf(exam.subjects?.[key]) != null ? `${scoreOf(exam.subjects[key])} 分` : "—"}</span><small>${esc(metric.detail)}</small></div>`; }).join("")}</div>` : `<p class="muted">还没有足够的同口径数据。历史仍会保留，数据够用时再比较。</p>`}</section><section class="reading-section subjects-section"><div class="section-head-simple"><div><div class="section-label">六科</div><h2>这次考试的具体坐标</h2></div></div><div class="subject-rows">${renderSubjectRows(exam)}</div></section>${canEdit() ? `<section class="overview-actions" aria-label="下一步"><button class="btn btn-primary btn-block" data-action="${primaryAction}" data-id="${esc(exam.id)}" data-primary-action="record-next">${primaryLabel}</button><button class="btn btn-outline" data-action="open-trajectory" aria-controls="deep-trajectory">查看完整轨迹</button></section>` : ""}${renderDeepTrajectory()}`;
}

function renderExamList() {
  const rows = state.exams.map((exam) => `<div class="exam-list-row" data-action="edit-exam" data-id="${esc(exam.id)}" tabindex="0" role="button"><div class="exam-list-title"><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}</small></div>${coordinateRow(exam, "exam-list-coordinate")}<span class="row-chevron" aria-hidden="true">›</span></div>`).join("");
  const trash = state.trash.length ? `<section class="reading-section trash-section"><div class="section-label">最近删除</div><div class="trash-list">${state.trash.map((exam) => `<div class="trash-row"><div><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · 删除于 ${esc(exam.deletedAt?.slice(0, 10) || "")}</small></div>${canEdit() ? `<button class="btn btn-outline btn-small" data-action="restore-exam" data-id="${esc(exam.id)}" data-revision="${exam.revision}">撤销删除</button>` : ""}</div>`).join("")}</div></section>` : "";
  return `<section><div class="page-heading"><div><h1>考试</h1><p>每一场考试都是一个坐标，不用把不同难度的试卷机械横比。</p></div>${canEdit() ? `<button class="btn btn-primary" data-action="new-exam">记录考试</button>` : ""}</div>${rows ? `<div class="exam-list">${rows}</div>` : `<div class="empty-state compact"><h2>还没有考试记录</h2><p>先记录一场考试。</p></div>`}${trash}</section>`;
}

function shareFieldControls(prefix, scope) {
  const defaults = {
    displayName: true,
    graduationYear: false,
    school: false,
    className: false,
    overallScore: true,
    overallRank: true,
    subjectScores: true,
    subjectRanks: true,
    history: scope === "trajectory"
  };
  const fields = [
    ["displayName", "孩子名字 / 称呼"],
    ["graduationYear", "毕业年份"],
    ["school", "学校"],
    ["className", "班级"],
    ["overallScore", "总分"],
    ["overallRank", "总体排名"],
    ["subjectScores", "六科成绩"],
    ["subjectRanks", "六科排名"], ["examStatus", "考试情况"], ["comparisonContext", "可比范围"]
  ];
  return `<div class="check-grid">${fields.map(([key, label]) => `<label class="check"><input type="checkbox" name="${prefix}-${key}" ${defaults[key] ? "checked" : ""}>${label}</label>`).join("")}</div><input type="checkbox" name="${prefix}-history" ${defaults.history ? "checked" : ""} hidden>`;
}

// Legacy source wording retained: 默认只分享一场
function shareScope(prefix) {
  const trajectoryCopy = state.exams.length === 1 ? "从这一次开始；以后新增的考试可自动加入" : "把多次考试放在一起看";
  return `<div class="share-scope"><div class="share-title"><strong>想分享什么？</strong><small>先选范围；持续更新与当前快照可以在下方调整。</small></div><label><input type="radio" name="${prefix}-scope" value="single" checked><span><strong>这一次考试</strong><small>只分享选中的一场考试</small></span></label><label><input type="radio" name="${prefix}-scope" value="trajectory"><span><strong>成长轨迹</strong><small>${trajectoryCopy}</small></span></label><div class="field share-exam-picker"><label>选择考试</label><select data-share-exam="${prefix}">${state.exams.map((exam) => `<option value="${esc(exam.id)}">${esc(exam.name)} · ${fmtDate(exam.date)}</option>`).join("")}</select></div><label class="check share-future-ack" data-share-future-ack="${prefix}" hidden><input type="checkbox" name="${prefix}-future-exams-acknowledged">我知道以后新增的考试会自动进入这个分享链接</label></div>`;
}

function shareSummary(prefix) {
  return `<div class="share-summary" data-share-summary="${prefix}"><div><strong>将分享</strong><span>考试名称和日期、总体位置、六科成绩与排名</span></div><div><strong>不会分享</strong><span>家庭备注、登录账号、家庭成员和安全信息</span></div></div>`;
}

function renderShareList() {
  if (!state.shares.length) return `<div class="empty compact">当前没有外部分享。</div>`;
  return state.shares.map((item) => `<div class="share-item"><div><div><strong>${item.kind === "secret" ? "分享链接" : "公开链接"}</strong><span class="badge">${item.mode === "snapshot" ? "只分享当前内容" : "持续更新"}</span>${item.scope === "single" ? `<span class="badge">单次${item.examName ? ` · ${esc(item.examName)}` : ""}</span>` : `<span class="badge">高三轨迹</span>`}</div><small>创建于 ${esc(item.createdAt?.slice(0, 10) || "")}${item.expiresAt ? ` · ${esc(item.expiresAt.slice(0, 10))} 自动失效` : ""}${item.kind === "secret" ? " · 出于安全考虑，这个地址不会再次显示。需要重新分享时，请生成新的链接。" : ` · /p/${esc(item.locator)}`}</small></div><button class="btn btn-danger btn-small" data-action="revoke-share" data-kind="${item.kind}" data-locator="${esc(item.locator)}">撤销</button></div>`).join("");
}

function renderSharing() {
  return `<section><div class="page-heading"><div><h1>分享</h1><p>默认只在家庭内可见。生成链接前，先确认别人会看到什么。</p></div></div><div class="share-layout"><article class="section-surface share-card" data-share-card="secret"><h2>分享链接</h2><p>只有拿到这个随机地址的人才能查看。需要时可以随时撤销。</p>${shareScope("secret")}${shareSummary("secret")}<details class="advanced"><summary>修改分享内容与自动失效</summary><div class="advanced-body"><div class="field"><label>更新方式</label><select id="secret-mode"><option value="live">持续更新</option><option value="snapshot">只分享当前内容</option></select></div><div class="field"><label>自动失效（可选）</label><input id="secret-expiry" type="date"></div>${shareFieldControls("secret", state.exams.length >= 2 ? "trajectory" : "single")}</div></details><button class="btn btn-primary btn-block" data-action="create-secret">生成并复制链接</button></article><details class="public-advanced"><summary><span><strong>公开链接（高级）</strong><small>任何拿到这个地址的人都可以查看。不会主动进入搜索，但这不等于私密。</small></span><span aria-hidden="true">＋</span></summary><article class="section-surface share-card" data-share-card="public">${shareScope("public")}${shareSummary("public")}<div class="field"><label>公开地址</label><div class="slug-field"><span>/p/</span><input id="public-slug" minlength="3" maxlength="50" autocapitalize="none" spellcheck="false" placeholder="例如 wang-2027"></div><small>3–50 位字母、数字或短横线。</small></div><details class="advanced"><summary>修改分享内容</summary><div class="advanced-body"><div class="field"><label>更新方式</label><select id="public-mode"><option value="live">持续更新</option><option value="snapshot">只分享当前内容</option></select></div>${shareFieldControls("public", state.exams.length >= 2 ? "trajectory" : "single")}</div></details><button class="btn btn-primary btn-block" data-action="create-public">创建公开链接</button></article></details><section class="reading-section current-shares"><div class="section-head-simple"><div><div class="section-label">当前分享</div><h2>已经创建的外部地址</h2></div></div><div>${renderShareList()}</div></section></div></section>`;
}

function memberRow(member) {
  const current = member.isCurrent ? `<span class="badge">当前账号</span>` : "";
  const disabled = member.disabledAt ? `<span class="badge badge-warn">已停用</span>` : "";
  const controls = isOwner() && !member.isCurrent && member.role !== "owner" ? `<div class="member-actions"><select data-member-role="${esc(member.id)}" aria-label="${esc(member.username)} 的权限"><option value="editor" ${member.role === "editor" ? "selected" : ""}>可编辑</option><option value="viewer" ${member.role === "viewer" ? "selected" : ""}>仅查看</option></select><button class="btn btn-outline btn-small" data-member-toggle="${esc(member.id)}" data-enabled="${member.disabledAt ? "false" : "true"}">${member.disabledAt ? "恢复登录" : "停用登录"}</button></div>` : "";
  return `<div class="member-row"><div><strong>${esc(member.username)}</strong>${current}${disabled}<small>${roleLabel(member.role)}</small></div>${controls}</div>`;
}

function studentRow(student) {
  return `<div class="student-row"><div><strong>${esc(student.displayName || "孩子")}</strong>${student.id === state.student?.id ? `<span class="badge">当前查看</span>` : ""}<small>${identityMeta(student) || "资料可稍后补充"}</small></div></div>`;
}

function renderFamily() {
  const student = state.student;
  const members = state.familyMembers.map(memberRow).join("") || `<div class="empty compact">暂无成员资料。</div>`;
  const students = (state.me?.students || []).map(studentRow).join("");
  const memberCreate = isOwner() ? `<details class="advanced family-add"><summary>添加家庭成员</summary><form id="family-member-create" class="form-stack advanced-body"><div class="field"><label>登录账号</label><input name="username" required minlength="3" maxlength="64" autocomplete="off"></div><div class="field"><label>初始密码</label><input name="password" type="password" required minlength="10" maxlength="256" autocomplete="new-password"><small>至少 10 个字符。请通过安全方式单独告诉对方。</small></div><div class="field"><label>权限</label><select name="role"><option value="editor">可编辑</option><option value="viewer">仅查看</option></select></div><button class="btn btn-primary" type="submit">添加成员</button></form></details>` : "";
  const studentCreate = canEdit() ? `<details class="advanced family-add"><summary>添加孩子</summary><form id="family-student-create" class="form-stack advanced-body"><div class="field"><label>孩子名字 / 称呼</label><input name="displayName" required maxlength="50"></div><div class="form-two"><div class="field"><label>毕业年份（可选）</label><input name="graduationYear" inputmode="numeric"></div><div class="field"><label>年级</label><input name="grade" value="高三"></div></div><div class="field"><label>学校（可选）</label><input name="schoolLabel"></div><div class="field"><label>班级（可选）</label><input name="className"></div><div class="field"><label>选科</label><input name="subjectTrack" value="物化生"></div><button class="btn btn-primary" type="submit">添加孩子</button></form></details>` : "";
  const archiveAction = isOwner() ? `<button type="button" class="btn btn-outline" data-action="toggle-archive" data-archived="${student.archivedAt ? "true" : "false"}">${student.archivedAt ? "恢复为进行中" : "毕业归档"}</button>` : "";
  return `<section><div class="page-heading"><div><h1>家庭</h1><p>家庭成员共享这一户的数据；每个人用自己的登录账号。</p></div></div><div class="family-layout"><section class="section-surface"><div class="section-head-simple"><div><div class="section-label">孩子</div><h2>家庭里的孩子</h2></div></div><div class="student-list">${students}</div>${studentCreate}</section><section class="section-surface"><div class="section-head-simple"><div><div class="section-label">家庭成员</div><h2>谁可以登录这个家庭</h2></div><span class="badge">你是 ${roleLabel(state.me?.member?.role)}</span></div><div class="member-list">${members}</div>${memberCreate}</section><section class="section-surface"><div class="section-head-simple"><div><div class="section-label">孩子资料</div><h2>${esc(student.displayName)}</h2></div>${archiveAction}</div><form id="profile-form" class="form-stack"><div class="field"><label>孩子名字 / 称呼</label><input name="displayName" value="${esc(student.displayName || "")}" ${canEdit() ? "" : "disabled"}></div><div class="form-two"><div class="field"><label>毕业年份</label><input name="graduationYear" inputmode="numeric" value="${esc(student.graduationYear || "")}" ${canEdit() ? "" : "disabled"}></div><div class="field"><label>当前班级</label><input name="className" value="${esc(student.className || "")}" ${canEdit() ? "" : "disabled"}></div></div><div class="field"><label>学校</label><input name="schoolLabel" value="${esc(student.schoolLabel || "")}" ${canEdit() ? "" : "disabled"}></div><div class="field"><label>选科</label><input name="subjectTrack" value="${esc(student.subjectTrack || "物化生")}" ${canEdit() ? "" : "disabled"}></div>${canEdit() ? `<button class="btn btn-primary" type="submit">保存资料</button>` : `<p class="muted">当前账号只有查看权限。</p>`}</form></section><section class="section-surface account-section"><div class="section-head-simple"><div><div class="section-label">账号</div><h2>安全与数据</h2></div></div><div class="account-actions"><button class="btn btn-outline" data-action="change-password">修改密码</button><button class="btn btn-outline" data-action="recovery-code">生成 / 更换恢复码</button><button class="btn btn-outline" data-action="export">导出全部数据</button><button class="btn btn-danger" data-action="logout-all">退出所有设备</button></div><div data-account-result></div></section>${isOwner() ? `<details class="advanced admin-advanced"><summary><span><strong>邀请另一户家庭使用高三坐标</strong><small>低频管理员功能；对方建立后数据与你完全隔离。</small></span><span aria-hidden="true">＋</span></summary><div class="advanced-body"><div class="invite-tools"><div class="field"><label>链接有效期</label><select id="invite-hours"><option value="24">24 小时</option><option value="72" selected>72 小时</option><option value="168">7 天</option></select></div><button class="btn btn-primary" data-action="create-invite">生成邀请链接</button></div><div data-invite-result></div><div class="invite-list">${state.invitations.map((item) => `<div class="invite-row"><strong>${item.usedAt ? "已领取" : new Date(item.expiresAt).getTime() <= Date.now() ? "已过期" : "等待领取"}</strong><span>创建 ${esc(item.createdAt?.slice(0, 10) || "")} · 到期 ${esc(item.expiresAt?.slice(0, 10) || "")}</span></div>`).join("") || `<div class="empty compact">还没有发出邀请。</div>`}</div><hr><h3>对方恢复码也丢了</h3><p>输入对方登录账号，可生成一条 15 分钟一次性重置链接。你看不到对方密码。</p><div class="invite-tools"><div class="field"><label>对方登录账号</label><input id="recovery-username" autocomplete="off"></div><button class="btn btn-outline" data-action="create-recovery-link">生成重置链接</button></div><div data-recovery-link-result></div></div></details>` : ""}</div></section>`;
}

function renderDashboard() {
  let body = state.tab === "overview" ? renderOverview() : state.tab === "exams" ? renderExamList() : state.tab === "sharing" ? renderSharing() : renderFamily();
  if (state.tab === "overview") body = trajectorySubnav(state.trajectoryView) + body;
  document.body.dataset.familyId = state.me?.family?.id || "";
  document.body.dataset.memberId = state.me?.member?.id || "";
  document.body.dataset.studentId = state.student?.id || "";
  app.innerHTML = `${renderHeader()}<main class="container"><nav class="tabs" aria-label="主导航"><button class="tab ${state.tab === "overview" ? "active" : ""}" data-tab="overview">轨迹</button><button class="tab ${state.tab === "exams" ? "active" : ""}" data-tab="exams">考试</button><button class="tab ${state.tab === "sharing" ? "active" : ""}" data-tab="sharing">分享</button><button class="tab ${state.tab === "family" ? "active" : ""}" data-tab="family">家庭</button></nav><div class="status-region is-${state.noticeTone}" data-status-region role="status" aria-live="polite" ${state.notice ? "" : "hidden"}>${esc(state.notice)}</div>${body}</main><footer class="footer">${PRODUCT_NAME} · 数据默认只对家庭成员可见 · ${esc(state.me?.appVersion || "")}</footer>`;
  bindDashboard();
}

function renderLogin(error = "") {
  app.innerHTML = `<main class="login-shell"><section class="login-card">${brandMark()}<h1>${PRODUCT_NAME}</h1><p>${PRODUCT_TAGLINE}。</p>${error ? `<div class="error-box" role="alert">${esc(error)}</div>` : ""}<form id="login-form"><div class="field"><label>登录账号</label><input name="username" autocomplete="username" required></div><div class="field"><label>密码</label><input name="password" type="password" autocomplete="current-password" minlength="10" required></div><button class="btn btn-primary btn-block" type="submit">登录</button></form><div class="login-help"><a href="/forgot">忘记密码？使用恢复码</a></div><small class="login-privacy">数据默认只对家庭成员可见。</small></section></main>`;
  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    const form = new FormData(event.currentTarget);
    button.disabled = true;
    button.textContent = "正在登录…";
    try {
      const result = await api("/api/login", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      state.csrf = result.csrf;
      await loadPrivateApp();
    } catch (error) {
      renderLogin(error.message);
    }
  });
}

function rankInputs(prefix, ranking, label) {
  return `<div class="rank-pair"><span>${label}</span><input name="${prefix}-rank" inputmode="numeric" placeholder="名次" value="${ranking?.rank ?? ""}" aria-label="${label}名次"><span>/</span><input name="${prefix}-participants" inputmode="numeric" placeholder="人数可空" value="${ranking?.participants ?? ""}" aria-label="${label}总人数"><span>人</span></div>`;
}

function subjectEditor(exam, key, label, full) {
  const subject = exam?.subjects?.[key] || {};
  const school = rankByScope(subject.rankings, "school");
  const clazz = rankByScope(subject.rankings, "class");
  const defaultMode = ["chemistry", "biology"].includes(key) ? "raw_and_converted" : "raw";
  const mode = subject.scoreMode || defaultMode;
  return `<article class="exam-subject-card" data-subject="${key}"><div class="exam-subject-head"><h4>${label}</h4><span>常用满分 ${full}</span></div><div class="subject-score-grid"><div class="field"><label>成绩</label><input name="${key}-raw" inputmode="decimal" value="${subject.rawScore ?? ""}"></div><div class="field converted-field" ${mode === "raw" ? "hidden" : ""}><label>赋分后</label><input name="${key}-final" inputmode="decimal" value="${subject.finalScore ?? ""}" ${mode === "raw" ? "disabled" : ""}></div></div><div class="subject-ranks">${rankInputs(`${key}-school`, school, "学校")}${rankInputs(`${key}-class`, clazz, "班级")}</div><details class="subject-advanced"><summary>计分与满分</summary><div class="form-two"><div class="field"><label>计分方式</label><select name="${key}-mode" data-score-mode="${key}"><option value="raw" ${mode === "raw" ? "selected" : ""}>原始分</option><option value="raw_and_converted" ${mode === "raw_and_converted" ? "selected" : ""}>原始分 + 赋分</option><option value="converted" ${mode === "converted" ? "selected" : ""}>只记录赋分</option></select></div><div class="field"><label>满分</label><input name="${key}-full" inputmode="decimal" value="${subject.fullScore ?? full}"></div></div></details></article>`;
}

function examDialog(exam = null) {
  state.editingExam = exam;
  const school = overallRank(exam, "school");
  const clazz = overallRank(exam, "class");
  const joint = overallRank(exam, "joint");
  const special = ["good", "poor", "partial"].includes(exam?.status);
  document.body.insertAdjacentHTML("beforeend", `<div class="dialog-backdrop" id="exam-dialog"><form class="dialog exam-dialog" id="exam-form"><div class="dialog-head"><div><h2>${exam ? "查看 / 编辑考试" : "记录一次考试"}</h2><p>按拿到成绩单时的顺序填写；不知道的数据可以留空。</p></div><button type="button" class="btn btn-outline btn-small" data-close-dialog>关闭</button></div><section class="exam-section"><h3>这次是什么考试</h3><div class="exam-context-grid"><div class="field"><label>考试名称</label><input name="name" required value="${esc(exam?.name || "")}" placeholder="例如 高三二模"></div><div class="field"><label>日期</label><input name="date" type="date" required value="${esc(exam?.date || new Date().toISOString().slice(0, 10))}"></div><div class="field"><label>类型</label><select name="type">${Object.entries(EXAM_TYPES).map(([value, label]) => `<option value="${value}" ${exam?.type === value ? "selected" : ""}>${label}</option>`).join("")}</select></div></div></section><section class="exam-section"><h3>总分与整体位置</h3><div class="overall-entry"><div class="field"><label>学校公布总分</label><input name="officialScore" inputmode="decimal" value="${exam?.overall?.officialScore ?? ""}"></div><div class="overall-ranks">${rankInputs("overall-school", school, "学校")}${rankInputs("overall-class", clazz, "班级")}<div class="rank-pair joint-rank" data-joint-rank ${exam?.type === "joint" ? "" : "hidden"}><span>联考</span><input name="overall-joint-rank" inputmode="numeric" placeholder="名次" value="${joint?.rank ?? ""}" ${exam?.type === "joint" ? "" : "disabled"}><span>/</span><input name="overall-joint-participants" inputmode="numeric" placeholder="人数可空" value="${joint?.participants ?? ""}" ${exam?.type === "joint" ? "" : "disabled"}><span>人</span></div></div></div><details class="advanced exam-more"><summary>更多考试信息（可选）</summary><div class="advanced-body"><div class="form-two"><div class="field"><label>考试范围</label><select name="comparisonLevel">${COMPARISON_LEVELS.map(([value, label]) => `<option value="${value}" ${exam?.comparison?.level === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label>属于同一个考试系列</label><input name="comparisonSeries" maxlength="60" value="${esc(exam?.comparison?.series || "")}" placeholder="例如 2027届三次模拟考试"></div></div><div class="field"><label>特殊情况</label><select name="status"><option value="normal" ${!special && exam?.status !== "absent" ? "selected" : ""}>正常记录</option><option value="poor" ${special ? "selected" : ""}>有特殊情况</option><option value="absent" ${exam?.status === "absent" ? "selected" : ""}>缺考</option></select><small>具体发生了什么，写在下方“想记住的事”里。</small></div></div></details></section><section class="exam-section"><div class="section-head-simple"><div><h3>六科成绩与排名</h3><p>先成绩，再排名；总人数不知道就留空。</p></div></div><div class="exam-subject-cards">${SUBJECTS.map(([key, label, full]) => subjectEditor(exam, key, label, full)).join("")}</div></section><div class="field exam-notes"><label>想记住的事（仅家庭内部）</label><textarea name="notes" placeholder="例如：数学圆锥曲线失分较多">${esc(exam?.notes || "")}</textarea></div><div class="draft-state" data-draft-state>${exam ? "修改后保存才会更新" : "草稿会自动保存在本机"}</div><div id="exam-form-error" role="alert"></div><div class="dialog-actions">${exam && canEdit() ? `<button type="button" class="btn btn-danger" data-action="delete-exam">删除</button>` : ""}<button type="button" class="btn btn-outline" data-close-dialog>取消</button>${canEdit() ? `<button class="btn btn-primary" type="submit">保存考试</button>` : ""}</div></form></div>`);
  const form = document.querySelector("#exam-form");
  form.querySelector(".exam-notes")?.insertAdjacentHTML("afterend", `<section class="reflection-entry"><h3>给自己的回看（仅家庭内部）</h3><div class="field"><label>我想补充一句</label><textarea name="reflectionStudentNote" maxlength="500" placeholder="这次最想记住的感受">${esc(exam?.reflection?.studentNote || "")}</textarea></div><div class="field"><label>下次想试试</label><textarea name="reflectionNextTry" maxlength="500" placeholder="一个具体、可做到的小尝试">${esc(exam?.reflection?.nextTry || "")}</textarea></div></section>`);
  if (exam) form.dataset.examId = exam.id;
  if (!exam) {
    try {
      const preference = JSON.parse(localStorage.getItem("score-entry-preferences") || "{}");
      if (preference.type && form.querySelector("[name='type']")) form.querySelector("[name='type']").value = preference.type;
    } catch {}
  }
  const sections = [...form.querySelectorAll(".exam-section")];
  let step = exam && examCompleteness(exam).missingSubjects.length ? 2 : 0;
  const stepper = document.createElement("div");
  stepper.className = "entry-stepper";
  stepper.innerHTML = ["考试信息", "总分与位置", "六科明细"].map((label, index) => `<span data-entry-step="${index}">${index + 1}. ${label}</span>`).join("");
  form.querySelector(".dialog-head")?.after(stepper);
  const navigator = document.createElement("div");
  navigator.className = "entry-navigation";
  navigator.innerHTML = `<button type="button" class="btn btn-outline btn-small" data-entry-back>上一步</button><span data-entry-hint>${exam && step === 2 ? "继续补充尚未拿到的科目；已有内容不会改变。" : "先填考试名称和日期，不知道的数据可以留空。"}</span><button type="button" class="btn btn-outline btn-small" data-entry-next>下一步</button>`;
  form.querySelector(".dialog-actions")?.before(navigator);
  const renderStep = () => {
    sections.forEach((section, index) => { section.hidden = index !== step; });
    stepper.querySelectorAll("[data-entry-step]").forEach((node, index) => node.classList.toggle("is-active", index === step));
    navigator.querySelector("[data-entry-back]").disabled = step === 0;
    navigator.querySelector("[data-entry-next]").textContent = step === sections.length - 1 ? "检查并保存" : "下一步";
  };
  navigator.querySelector("[data-entry-back]").addEventListener("click", () => { step = Math.max(0, step - 1); renderStep(); });
  navigator.querySelector("[data-entry-next]").addEventListener("click", () => { if (step < sections.length - 1) { step += 1; renderStep(); } else { setDraftState(form, "本机草稿尚未提交；请点击保存考试"); form.querySelector("button[type='submit']")?.focus(); } });
  renderStep();
  if (!canEdit()) form.querySelectorAll("input, select, textarea").forEach((control) => { control.disabled = true; });
  form.querySelector("[name='type']")?.addEventListener("change", (event) => {
    const row = form.querySelector("[data-joint-rank]");
    const visible = event.target.value === "joint";
    row.hidden = !visible;
    row.querySelectorAll("input").forEach((input) => { input.disabled = !visible; });
  });
  form.querySelectorAll("[data-score-mode]").forEach((select) => select.addEventListener("change", () => syncSubjectMode(form, select.dataset.scoreMode)));
  form.querySelectorAll("[data-score-mode]").forEach((select) => syncSubjectMode(form, select.dataset.scoreMode));
  form.addEventListener("score:draft-restored", () => {
    form.querySelectorAll("[data-score-mode]").forEach((select) => syncSubjectMode(form, select.dataset.scoreMode));
    const draftState = form.querySelector("[data-draft-state]");
    if (draftState) draftState.textContent = "已恢复上次未保存的内容";
  });
  form.addEventListener("keydown", (event) => { if (event.key === "Escape") closeDialog(); });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", closeDialog));
  if (canEdit()) form.addEventListener("submit", saveExam);
  form.querySelector("[data-action='delete-exam']")?.addEventListener("click", deleteExam);
}

function syncSubjectMode(form, key) {
  const mode = form.querySelector(`[name='${key}-mode']`)?.value || "raw";
  const card = form.querySelector(`[data-subject='${key}']`);
  const converted = card?.querySelector(".converted-field");
  const final = form.querySelector(`[name='${key}-final']`);
  const show = mode !== "raw";
  if (converted) converted.hidden = !show;
  if (final) final.disabled = !show;
  const rawLabel = form.querySelector(`[name='${key}-raw']`)?.closest(".field")?.querySelector("label");
  if (rawLabel) rawLabel.textContent = mode === "converted" ? "原始分（可选）" : mode === "raw_and_converted" ? "原始分" : "成绩";
}

function closeDialog() {
  document.querySelector("#exam-dialog")?.remove();
  document.querySelector("#password-dialog")?.remove();
  state.editingExam = null;
}

function value(form, name) {
  const raw = form.get(name);
  return raw === "" || raw == null ? null : raw;
}

function intOrNull(raw) {
  if (raw == null || raw === "") return null;
  const number = Number(raw);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function numOrNull(raw) {
  if (raw == null || raw === "") return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function rankingFromForm(form, prefix, scope, label) {
  const rank = intOrNull(value(form, `${prefix}-rank`));
  const participants = intOrNull(value(form, `${prefix}-participants`));
  if (rank == null && participants == null) return null;
  return { scope, label, rank, participants, basis: "final_score" };
}

function deriveDataStatus(subjects, officialScore) {
  const six = SUBJECTS.every(([key]) => scoreOf(subjects[key]) != null);
  return six && officialScore != null ? "complete" : "partial";
}

function validateExamEntry(subjects, form) {
  for (const [key, label] of SUBJECTS) {
    const full = subjects[key].fullScore;
    if (subjects[key].rawScore != null && full != null && subjects[key].rawScore > full) return `${label}原始分不能高于 ${full} 分`;
    for (const scope of ["school", "class"]) {
      const rank = intOrNull(value(form, `${key}-${scope}-rank`));
      const participants = intOrNull(value(form, `${key}-${scope}-participants`));
      if (rank != null && participants != null && rank > participants) return `${label}的${scope === "school" ? "学校" : "班级"}排名不能大于参与人数`;
    }
  }
  for (const scope of ["school", "class", "joint"]) {
    const rank = intOrNull(value(form, `overall-${scope}-rank`));
    const participants = intOrNull(value(form, `overall-${scope}-participants`));
    if (rank != null && participants != null && rank > participants) return `总体${scope === "school" ? "学校" : scope === "class" ? "班级" : "联考"}排名不能大于参与人数`;
  }
  return null;
}

async function saveExam(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const button = formElement.querySelector("button[type='submit']");
  const form = new FormData(formElement);
  const subjects = {};
  for (const [key, , full] of SUBJECTS) {
    const mode = value(form, `${key}-mode`) || "raw";
    const raw = numOrNull(value(form, `${key}-raw`));
    const final = mode === "raw" ? null : numOrNull(value(form, `${key}-final`));
    subjects[key] = {
      scoreMode: mode,
      fullScore: numOrNull(value(form, `${key}-full`)) ?? full,
      rawScore: raw,
      finalScore: final,
      rankings: [rankingFromForm(form, `${key}-school`, "school", "学校"), rankingFromForm(form, `${key}-class`, "class", state.student.className || "班级")].filter(Boolean)
    };
  }
  const overallRankings = [rankingFromForm(form, "overall-school", "school", "学校"), rankingFromForm(form, "overall-class", "class", state.student.className || "班级")];
  if (value(form, "type") === "joint") overallRankings.push(rankingFromForm(form, "overall-joint", "joint", "联考"));
  const officialScore = numOrNull(value(form, "officialScore"));
  const payload = {
    name: value(form, "name"),
    date: value(form, "date"),
    type: value(form, "type"),
    status: value(form, "status") || "normal",
    dataStatus: deriveDataStatus(subjects, officialScore),
    comparison: { series: value(form, "comparisonSeries"), level: value(form, "comparisonLevel") },
    overall: { officialScore, rankings: overallRankings.filter(Boolean) },
    subjects,
    notes: value(form, "notes"),
    reflection: { studentNote: value(form, "reflectionStudentNote"), nextTry: value(form, "reflectionNextTry") },
    expectedRevision: state.editingExam?.revision
  };
  const validationMessage = validateExamEntry(subjects, form);
  if (validationMessage) {
    formElement.querySelector("#exam-form-error").innerHTML = `<div class="error-box">${esc(validationMessage)}</div>`;
    return;
  }
  try { localStorage.setItem("score-entry-preferences", JSON.stringify({ type: payload.type })); } catch {}
  button.disabled = true;
  button.textContent = "正在保存…";
  try {
    if (state.editingExam) await api(`/api/students/${state.student.id}/exams/${state.editingExam.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api(`/api/students/${state.student.id}/exams`, { method: "POST", body: JSON.stringify(payload) });
    const wasNew = !state.editingExam;
    formElement.dispatchEvent(new CustomEvent("score:save-succeeded", { bubbles: true }));
    closeDialog();
    await loadStudentData();
    state.tab = wasNew ? "overview" : "exams";
    state.notice = "考试已保存";
    state.noticeTone = "success";
    renderDashboard();
  } catch (error) {
    button.disabled = false;
    button.textContent = "保存考试";
    formElement.querySelector("#exam-form-error").innerHTML = `<div class="error-box">${esc(error.message)}</div>`;
  }
}

async function deleteExam() {
  if (!state.editingExam || !confirm(`确认删除“${state.editingExam.name}”？`)) return;
  try {
    await api(`/api/students/${state.student.id}/exams/${state.editingExam.id}`, { method: "DELETE", body: JSON.stringify({ expectedRevision: state.editingExam.revision }) });
    closeDialog();
    await loadStudentData();
    state.notice = "考试已删除";
    state.noticeTone = "success";
    renderDashboard();
  } catch (error) {
    document.querySelector("#exam-form-error").innerHTML = `<div class="error-box">${esc(error.message)}</div>`;
  }
}

function selectedShareFields(prefix, scope) {
  const result = {};
  for (const key of ["displayName", "graduationYear", "school", "className", "overallScore", "overallRank", "subjectScores", "subjectRanks", "examStatus", "comparisonContext"]) {
    result[key] = Boolean(document.querySelector(`[name='${prefix}-${key}']`)?.checked);
  }
  result.history = scope === "trajectory";
  return result;
}

function syncShareCard(prefix) {
  const scope = document.querySelector(`input[name='${prefix}-scope']:checked`)?.value || "single";
  const mode = document.querySelector(`#${prefix}-mode`)?.value || "live";
  const picker = document.querySelector(`[data-share-exam='${prefix}']`);
  if (picker) picker.disabled = scope !== "single";
  const history = document.querySelector(`[name='${prefix}-history']`);
  if (history) history.checked = scope === "trajectory";
  const futureAck = document.querySelector(`[data-share-future-ack='${prefix}']`);
  const needsFutureAck = scope === "trajectory" && mode === "live" && state.exams.length === 1;
  if (futureAck) futureAck.hidden = !needsFutureAck;
  const summary = document.querySelector(`[data-share-summary='${prefix}']`);
  if (summary) {
    const checked = [
      ["displayName", "孩子名字 / 称呼"], ["graduationYear", "毕业年份"], ["school", "学校"], ["className", "班级"],
      ["overallScore", "总分"], ["overallRank", "总体排名"], ["subjectScores", "六科成绩"], ["subjectRanks", "六科排名"], ["examStatus", "考试情况"], ["comparisonContext", "可比范围"]
    ].filter(([key]) => document.querySelector(`[name='${prefix}-${key}']`)?.checked).map(([, label]) => label);
    const futureCopy = scope === "trajectory" && mode === "live" ? "；以后新增考试也会进入此链接" : mode === "snapshot" ? "；内容固定在创建时" : "";
    const included = [scope === "trajectory" ? "成长轨迹" : "这一次考试", "考试名称和日期", ...checked];
    summary.innerHTML = `<div><strong>将分享</strong><span>${esc([...new Set(included)].join("、"))}${esc(futureCopy)}</span></div><div><strong>不会分享</strong><span>学生复盘、家庭备注、登录账号、家庭成员和安全信息</span></div>`;
  }
}

async function createShare(kind) {
  const prefix = kind === "public" ? "public" : "secret";
  const button = document.querySelector(`[data-action='create-${prefix}']`);
  const scope = document.querySelector(`input[name='${prefix}-scope']:checked`)?.value || "single";
  const body = {
    kind,
    mode: document.querySelector(`#${prefix}-mode`)?.value || "live",
    scope,
    fields: selectedShareFields(prefix, scope)
  };
  if (scope === "trajectory" && body.mode === "live" && state.exams.length === 1) {
    body.futureExamsAcknowledged = Boolean(document.querySelector(`[name='${prefix}-future-exams-acknowledged']`)?.checked);
    if (!body.futureExamsAcknowledged) {
      setNotice("请先确认以后新增的考试会自动进入这个分享链接", "error");
      return;
    }
  }
  if (scope === "single") body.examId = document.querySelector(`[data-share-exam='${prefix}']`)?.value || state.exams[0]?.id;
  if (kind === "secret") {
    const expiry = document.querySelector("#secret-expiry")?.value;
    if (expiry) {
      const [year, month, day] = expiry.split("-").map(Number);
      body.expiresAt = new Date(year, month - 1, day + 1, 0, 0, 0, -1).toISOString();
    }
  } else {
    body.slug = document.querySelector("#public-slug")?.value?.trim() || "";
  }
  button.disabled = true;
  button.textContent = "正在生成…";
  try {
    const result = await api(`/api/students/${state.student.id}/shares`, { method: "POST", body: JSON.stringify(body) });
    await loadShares();
    const url = kind === "secret" ? `${location.origin}/share/${result.token}` : `${location.origin}/p/${result.share.locator}`;
    const copied = await copyText(url);
    state.notice = `${kind === "secret" ? "分享链接" : "公开链接"}已生成${copied ? "并复制" : ""}：${url}`;
    state.noticeTone = "success";
    renderDashboard();
  } catch (error) {
    button.disabled = false;
    button.textContent = kind === "secret" ? "生成并复制链接" : "创建公开链接";
    setNotice(`创建失败：${error.message}`, "error");
  }
}

async function revokeShare(kind, locator) {
  if (!confirm("撤销后，这个外部地址会立即失效。继续吗？")) return;
  try {
    await api(`/api/students/${state.student.id}/shares/revoke`, { method: "POST", body: JSON.stringify({ kind, locator }) });
    await loadShares();
    state.notice = "分享已撤销";
    state.noticeTone = "success";
    renderDashboard();
  } catch (error) {
    setNotice(error.message, "error");
  }
}

async function exportData() {
  try {
    const data = await api(isOwner() ? "/api/family/export" : `/api/students/${state.student.id}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `score-${state.me?.family?.displayName || state.student.displayName}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("全部数据已导出", "success");
  } catch (error) {
    setNotice(error.message, "error");
  }
}

function passwordDialog() {
  document.body.insertAdjacentHTML("beforeend", `<div class="dialog-backdrop" id="password-dialog"><form class="dialog password-dialog" id="password-form"><div class="dialog-head"><div><h2>修改密码</h2><p>修改后，其他设备需要重新登录。</p></div><button type="button" class="btn btn-outline btn-small" data-close-password>关闭</button></div><div class="form-stack"><div class="field"><label>当前密码</label><input name="currentPassword" type="password" autocomplete="current-password" required></div><div class="field"><label>新密码</label><input name="newPassword" type="password" autocomplete="new-password" minlength="10" required><small>至少 10 个字符。</small></div><div class="field"><label>再次输入新密码</label><input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" required></div></div><div id="password-error" role="alert"></div><div class="dialog-actions"><button type="button" class="btn btn-outline" data-close-password>取消</button><button class="btn btn-primary" type="submit">修改密码</button></div></form></div>`);
  document.querySelectorAll("[data-close-password]").forEach((button) => button.addEventListener("click", closeDialog));
  document.querySelector("#password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = form.get("currentPassword");
    const newPassword = form.get("newPassword");
    const confirmPassword = form.get("confirmPassword");
    const error = event.currentTarget.querySelector("#password-error");
    if (newPassword !== confirmPassword) {
      error.innerHTML = `<div class="error-box">两次输入的新密码不一致。</div>`;
      return;
    }
    const button = event.currentTarget.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "正在修改…";
    try {
      const result = await api("/api/me/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      state.csrf = result.csrf;
      closeDialog();
      setNotice("密码已修改，其他设备需要重新登录。", "success");
    } catch (err) {
      button.disabled = false;
      button.textContent = "修改密码";
      error.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    }
  });
}

async function generateRecoveryCode() {
  const target = document.querySelector("[data-account-result], [data-recovery-required-result]");
  try {
    const result = await api("/api/me/recovery-code", { method: "POST", body: "{}" });
    target.innerHTML = `<div class="generated-secret"><strong>新的账户恢复码</strong><code>${esc(result.recoveryCode)}</code><p>恢复码只显示这一次，请离线保存。生成后旧恢复码立即失效。</p><button class="btn btn-outline btn-small" data-copy-recovery>复制恢复码</button></div>`;
    target.querySelector("[data-copy-recovery]")?.addEventListener("click", async (event) => {
      const ok = await copyText(result.recoveryCode);
      event.currentTarget.textContent = ok ? "已复制" : "复制失败";
    });
  } catch (error) {
    target.innerHTML = `<div class="error-box">${esc(error.message)}</div>`;
  }
}

function renderRecoveryRequired() {
  app.innerHTML = `<main class="login-shell"><section class="login-card recovery-required">${brandMark()}<h1>先保存账户恢复码</h1><p>这是第一次登录。恢复码用于忘记密码时找回账号，只显示一次，请离线保存。</p><button class="btn btn-primary btn-block" data-action="recovery-required">生成恢复码</button><div data-recovery-required-result></div><p class="muted">保存后即可进入高三坐标；恢复码不会分享给其他家庭成员。</p></section></main>`;
  document.querySelector("[data-action='recovery-required']")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    await generateRecoveryCode();
    if (document.querySelector("[data-recovery-required-result] code")) {
      const result = document.querySelector("[data-recovery-required-result]");
      result.insertAdjacentHTML("beforeend", `<label class="check recovery-ack"><input type="checkbox" data-recovery-ack>我已将恢复码保存在安全位置</label>`);
      result.querySelector("[data-recovery-ack]")?.addEventListener("change", (e) => { if (e.target.checked) { state.me.recoveryReady = true; loadStudentData().then(renderDashboard); } });
    }
  });
}

async function createInvite() {
  const target = document.querySelector("[data-invite-result]");
  const button = document.querySelector("[data-action='create-invite']");
  button.disabled = true;
  try {
    const hours = Number(document.querySelector("#invite-hours")?.value || 72);
    const result = await api("/api/admin/invitations", { method: "POST", body: JSON.stringify({ expiresInHours: hours }) });
    const url = `${location.origin}/join/${result.token}`;
    const copied = await copyText(url);
    target.innerHTML = `<div class="generated-link"><strong>把这个一次性地址发给对方：</strong><span>${esc(url)}</span><small>${copied ? "已复制" : "可以长按或手动复制"}</small></div>`;
    await loadFamilyData();
  } catch (error) {
    target.innerHTML = `<div class="error-box">${esc(error.message)}</div>`;
  } finally {
    button.disabled = false;
  }
}

async function createRecoveryLink() {
  const username = document.querySelector("#recovery-username")?.value?.trim();
  const target = document.querySelector("[data-recovery-link-result]");
  if (!username) {
    target.innerHTML = `<div class="error-box">请输入对方登录账号。</div>`;
    return;
  }
  try {
    const result = await api("/api/admin/recovery-links", { method: "POST", body: JSON.stringify({ username }) });
    const url = `${location.origin}/recover/${result.token}`;
    const copied = await copyText(url);
    target.innerHTML = `<div class="generated-link"><strong>15 分钟一次性重置地址：</strong><span>${esc(url)}</span><small>${copied ? "已复制" : "请手动复制"}</small></div>`;
  } catch (error) {
    target.innerHTML = `<div class="error-box">${esc(error.message)}</div>`;
  }
}

async function loadStudentData() {
  if (!state.student) return;
  const result = await api(`/api/students/${state.student.id}/exams`);
  state.exams = result.exams || [];
  try {
    const trash = await api(`/api/students/${state.student.id}/exams/trash`);
    state.trash = trash.exams || [];
  } catch { state.trash = []; }
}

async function restoreExam(id, revision) {
  try {
    await api(`/api/students/${state.student.id}/exams/${encodeURIComponent(id)}/restore`, { method: "POST", body: JSON.stringify({ expectedRevision: Number(revision) }) });
    await loadStudentData();
    state.notice = "考试已恢复";
    state.noticeTone = "success";
    renderDashboard();
  } catch (error) { setNotice(error.message, "error"); }
}

async function loadShares() {
  if (!state.student) return;
  const result = await api(`/api/students/${state.student.id}/shares`);
  state.shares = result.shares || [];
}

async function loadFamilyData() {
  try {
    const members = await api("/api/family/members");
    state.familyMembers = members.members || [];
  } catch {
    state.familyMembers = [];
  }
  if (isOwner()) {
    try {
      const invitations = await api("/api/admin/invitations");
      state.invitations = invitations.invitations || [];
    } catch {
      state.invitations = [];
    }
  }
}

async function loadPrivateApp() {
  try {
    state.me = await api("/api/me");
    state.csrf = state.me.csrf;
    if (!state.me.recoveryReady) return renderRecoveryRequired();
    state.student = state.me.students?.[0] || null;
    if (!state.student) throw new Error("当前家庭还没有孩子资料");
    await loadStudentData();
    renderDashboard();
  } catch (error) {
    if (error.status === 401) renderLogin();
    else renderLogin(error.message);
  }
}

function bindDashboard() {
  document.querySelectorAll("[data-trajectory-view]").forEach((button) => button.addEventListener("click", () => {
    state.trajectoryView = button.dataset.trajectoryView;
    state.selectedExamId = null;
    const url = new URL(location.href);
    url.searchParams.set("view", state.trajectoryView);
    url.searchParams.delete("exam");
    history.pushState({}, "", url);
    renderDashboard();
  }));
  document.querySelectorAll("[data-subject-key]").forEach((button) => button.addEventListener("click", () => {
    state.subjectKey = button.dataset.subjectKey;
    renderDashboard();
  }));
  document.querySelectorAll("[data-subject-metric]").forEach((button) => button.addEventListener("click", () => {
    state.subjectMetric = button.dataset.subjectMetric;
    renderDashboard();
  }));
  document.querySelectorAll("[data-action='view-exam']").forEach((row) => row.addEventListener("click", (event) => {
    event.preventDefault();
    state.selectedExamId = row.dataset.id;
    const url = new URL(row.href, location.href);
    history.pushState({}, "", url);
    renderDashboard();
    document.querySelector(".exam-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", async () => {
    state.tab = button.dataset.tab;
    clearNotice();
    if (state.tab === "sharing") await loadShares();
    if (state.tab === "family") await loadFamilyData();
    renderDashboard();
  }));
  document.querySelectorAll("[data-tab-jump]").forEach((button) => button.addEventListener("click", async () => {
    state.tab = button.dataset.tabJump;
    if (state.tab === "family") await loadFamilyData();
    renderDashboard();
  }));
  document.querySelector("#student-select")?.addEventListener("change", async (event) => {
    state.student = state.me.students.find((student) => student.id === event.target.value) || state.me.students[0];
    await loadStudentData();
    if (state.tab === "sharing") await loadShares();
    renderDashboard();
  });
  document.querySelectorAll("[data-action='new-exam']").forEach((button) => button.addEventListener("click", () => examDialog()));
  document.querySelectorAll("[data-action='continue-exam']").forEach((button) => button.addEventListener("click", () => examDialog(state.exams.find(exam => exam.id === button.dataset.id))));
  document.querySelectorAll("[data-action='edit-exam']").forEach((row) => {
    const open = () => examDialog(state.exams.find((exam) => exam.id === row.dataset.id));
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
  });
  document.querySelectorAll("[data-action='restore-exam']").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); restoreExam(button.dataset.id, button.dataset.revision); }));
  document.querySelector("[data-action='open-trajectory']")?.addEventListener("click", () => {
    const details = document.querySelector("#deep-trajectory");
    if (!details) return;
    details.open = true;
    details.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelectorAll("[data-action='export']").forEach((button) => button.addEventListener("click", exportData));
  document.querySelectorAll("[data-action='logout']").forEach((button) => button.addEventListener("click", async () => { await api("/api/logout", { method: "POST" }).catch(() => {}); location.assign("/"); }));
  document.querySelector("[data-action='change-password']")?.addEventListener("click", passwordDialog);
  document.querySelector("[data-action='recovery-code']")?.addEventListener("click", generateRecoveryCode);
  document.querySelector("[data-action='logout-all']")?.addEventListener("click", async () => {
    if (!confirm("确认让所有设备退出登录？")) return;
    try {
      await api("/api/me/logout-all", { method: "POST", body: "{}" });
      location.assign("/");
    } catch (error) {
      setNotice(error.message, "error");
    }
  });
  document.querySelectorAll("input[name='secret-scope'], input[name='public-scope'], #secret-mode, #public-mode").forEach((input) => input.addEventListener("change", () => syncShareCard(input.name?.startsWith("secret") || input.id?.startsWith("secret") ? "secret" : "public")));
  document.querySelectorAll("[data-share-card] .check-grid input").forEach((input) => input.addEventListener("change", () => syncShareCard(input.name.startsWith("secret") ? "secret" : "public")));
  if (state.tab === "sharing") { syncShareCard("secret"); syncShareCard("public"); }
  document.querySelector("[data-action='create-secret']")?.addEventListener("click", () => createShare("secret"));
  document.querySelector("[data-action='create-public']")?.addEventListener("click", () => createShare("public"));
  document.querySelectorAll("[data-action='revoke-share']").forEach((button) => button.addEventListener("click", () => revokeShare(button.dataset.kind, button.dataset.locator)));
  document.querySelector("#profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api(`/api/students/${state.student.id}/profile`, { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
      state.student = result.student;
      state.me.students = state.me.students.map((student) => student.id === result.student.id ? result.student : student);
      state.notice = "孩子资料已保存";
      state.noticeTone = "success";
      renderDashboard();
    } catch (error) {
      setNotice(error.message, "error");
    }
  });
  document.querySelector("#family-member-create")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      const form = new FormData(event.currentTarget);
      await api("/api/family/members", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password"), role: form.get("role") }) });
      await loadFamilyData();
      state.notice = "家庭成员已添加";
      state.noticeTone = "success";
      renderDashboard();
    } catch (error) {
      button.disabled = false;
      setNotice(error.message, "error");
    }
  });
  document.querySelector("#family-student-create")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    button.disabled = true;
    try {
      const result = await api("/api/family/students", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
      state.me.students.push(result.student);
      state.student = result.student;
      await loadStudentData();
      await loadFamilyData();
      state.notice = `“${result.student.displayName}”已加入这个家庭`;
      state.noticeTone = "success";
      renderDashboard();
    } catch (error) {
      button.disabled = false;
      setNotice(error.message, "error");
    }
  });
  document.querySelectorAll("[data-member-role]").forEach((select) => select.addEventListener("change", async () => {
    try {
      await api(`/api/family/members/${encodeURIComponent(select.dataset.memberRole)}`, { method: "PATCH", body: JSON.stringify({ role: select.value }) });
      await loadFamilyData();
      state.notice = "成员权限已更新，对方需要重新登录";
      state.noticeTone = "success";
      renderDashboard();
    } catch (error) { setNotice(error.message, "error"); }
  }));
  document.querySelectorAll("[data-member-toggle]").forEach((button) => button.addEventListener("click", async () => {
    const enabled = button.dataset.enabled === "true";
    if (!confirm(`${enabled ? "停用" : "恢复"}这个家庭成员的登录权限？`)) return;
    try {
      await api(`/api/family/members/${encodeURIComponent(button.dataset.memberToggle)}`, { method: "PATCH", body: JSON.stringify({ enabled: !enabled }) });
      await loadFamilyData();
      state.notice = enabled ? "成员已停用，已有登录会话同时失效" : "成员登录权限已恢复";
      state.noticeTone = "success";
      renderDashboard();
    } catch (error) { setNotice(error.message, "error"); }
  }));
  document.querySelector("[data-action='toggle-archive']")?.addEventListener("click", async (event) => {
    const archived = event.currentTarget.dataset.archived === "true";
    if (!confirm(archived ? "恢复这份毕业归档资料？" : "归档后将撤销外部分享并停止继续录入，确认吗？")) return;
    try {
      const result = await api(`/api/students/${state.student.id}/lifecycle`, { method: "PATCH", body: JSON.stringify({ archived: !archived }) });
      state.student = result.student;
      state.me.students = state.me.students.map((s) => s.id === result.student.id ? result.student : s);
      await loadShares();
      state.notice = archived ? "资料已恢复为进行中" : "资料已归档，外部分享已撤销";
      state.noticeTone = "success";
      renderDashboard();
    } catch (error) { setNotice(error.message, "error"); }
  });
  document.querySelector("[data-action='create-invite']")?.addEventListener("click", createInvite);
  document.querySelector("[data-action='create-recovery-link']")?.addEventListener("click", createRecoveryLink);
}

function publicSubjectRows(exam, share = {}) {
  if (!exam?.subjects) return "";
  return SUBJECTS.map(([key, label]) => {
    const subject = exam.subjects[key] || {};
    const score = share.fields?.subjectScores === false ? null : scoreOf(subject);
    const school = share.fields?.subjectRanks === false ? null : rankByScope(subject.rankings, "school");
    const clazz = share.fields?.subjectRanks === false ? null : rankByScope(subject.rankings, "class");
    const meta = [school?.rank ? `校第 ${school.rank}` : null, clazz?.rank ? `班第 ${clazz.rank}` : null].filter(Boolean).join(" · ");
    return `<div class="subject-row"><strong>${label}</strong><b>${score == null ? (share.fields?.subjectScores === false ? "未分享" : "—") : score}</b><span>${esc(meta || (share.fields?.subjectRanks === false ? "排名未分享" : "排名待补"))}</span></div>`;
  }).join("");
}

function publicHistory(exams) {
  if (!Array.isArray(exams) || exams.length < 2) return "";
  return `<section class="public-history"><div class="section-label">历次轨迹</div><h2>把不同考试放回时间里看</h2><div class="history-list">${exams.map((exam, index) => {
    const projected = { ...exam, overall: { rankings: exam.overallRankings || [] }, overallScore: exam.overallScore };
    const school = overallRank(projected, "school");
    const clazz = overallRank(projected, "class");
    return `<div class="history-row ${index === 0 ? "is-latest" : ""}"><div><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}${index === 0 ? " · 最新" : ""}</small></div><div class="history-coordinate"><span>${school?.rank ? `校第 ${school.rank} 名` : ""}</span><span>${clazz?.rank ? `班第 ${clazz.rank} 名` : ""}</span><span>${overallScore(projected) != null ? `${fmtNumber(overallScore(projected))} 分` : ""}</span></div></div>`;
  }).join("")}</div><p class="muted">不同考试难度可能不同，优先看相对位置；分数只作辅助。页面只展示分享白名单中的字段。</p></section>`;
}

function publicViewNavV080(active = "total", subject = "chinese") {
  const items = [["total", "总成绩", ""], ["subject", "单科", `&subject=${encodeURIComponent(subject)}`], ["timeline", "时间轴", ""]];
  return `<nav class="public-view-nav" aria-label="分享视图">${items.map(([key, label, suffix]) => `<a class="public-view-tab ${active === key ? "active" : ""}" href="?view=${key}${suffix}" aria-current="${active === key ? "page" : "false"}">${label}</a>`).join("")}</nav>`;
}

// Backward contract: function publicBaselineV081(view, exams)
function publicBaselineV081(view, exams, share = {}) {
  if (!Array.isArray(exams) || exams.length !== 1) return "";
  const copy = {
    total: "目前只有一次考试记录。先看这一场的总成绩和位置；有下一次同口径记录后再比较。",
    subject: "目前只有一次考试记录。这里先呈现这一科的事实，不判断变化。",
    timeline: "时间轴从这一次开始。打开节点可以查看本场全部已分享信息。"
  };
  const future = share.includesFutureExams ? "以后新增的考试会自动出现在这里；当前页面只展示已分享字段。" : "这是创建分享时的当前内容；以后新增考试不会自动加入。";
  return `<aside class="public-baseline-note" aria-label="记录状态"><span class="public-baseline-mark" aria-hidden="true"></span><div><strong>当前基线</strong><p>${copy[view] || copy.total}</p><p>${future}</p></div></aside>`;
}

function publicSubjectComparisonV080(exams, key, share = {}) {
  const label = SUBJECTS.find(([subject]) => subject === key)?.[1] || "单科";
  const rows = exams.map((exam) => {
    const subject = exam.subjects?.[key] || {};
    const score = share.fields?.subjectScores === false ? null : scoreOf(subject);
    const school = share.fields?.subjectRanks === false ? null : rankByScope(subject.rankings, "school");
    const clazz = share.fields?.subjectRanks === false ? null : rankByScope(subject.rankings, "class");
    const values = [score == null ? null : `${fmtNumber(score)} 分`, school?.rank ? `校第 ${school.rank}` : null, clazz?.rank ? `班第 ${clazz.rank}` : null].filter(Boolean).join(" · ");
    return `<div class="subject-compare-row"><div><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}</small></div><b>${esc(values || "数据待补")}</b></div>`;
  }).join("");
  return `<section class="public-reading-section"><div class="section-label">单科</div><h2>${label}的历次记录</h2>${publicBaselineV081("subject", exams, share)}<div class="subject-picker public-subject-picker">${SUBJECTS.map(([subject, subjectLabel]) => `<a class="subject-chip ${subject === key ? "active" : ""}" href="?view=subject&subject=${encodeURIComponent(subject)}" aria-current="${subject === key ? "page" : "false"}">${subjectLabel}</a>`).join("")}</div>${rows || `<p class="muted">还没有可分享的${label}记录。</p>`}</section>`;
}

function publicExamDetailV080(exam, share = {}) {
  if (!exam) return "";
  const rows = SUBJECTS.map(([key, label]) => {
    const subject = exam.subjects?.[key] || {};
    const score = share.fields?.subjectScores === false ? null : scoreOf(subject);
    const school = share.fields?.subjectRanks === false ? null : rankByScope(subject.rankings, "school");
    const clazz = share.fields?.subjectRanks === false ? null : rankByScope(subject.rankings, "class");
    const values = [score == null ? "分数待补" : `${fmtNumber(score)} 分`, subject.fullScore ? `满分 ${subject.fullScore}` : null, school?.rank ? `校第 ${school.rank}` : null, clazz?.rank ? `班第 ${clazz.rank}` : null].filter(Boolean).join(" · ");
    return `<div class="exam-detail-subject"><strong>${label}</strong><span>${esc(values)}</span></div>`;
  }).join("");
  const overall = [share.fields?.overallScore === false ? "总分未分享" : scoreSummaryText(examScoreSummary(exam)), share.fields?.overallRank === false ? null : rankingDetails(exam.overallRankings || [])].filter(Boolean).join(" · ");
  return `<section class="public-reading-section public-exam-detail"><div class="section-label">考试详情</div><h2>${esc(exam.name)}</h2><p>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}</p><div class="exam-detail-overall"><strong>${esc(overall)}</strong></div><div class="exam-detail-subjects">${rows}</div></section>`;
}

function publicTimelineV080(exams, selectedExamId = null, share = {}) {
  const selected = exams.find((exam) => exam.id === selectedExamId) || null;
  const rows = exams.map((exam, index) => {
    const projected = { ...exam, overall: { rankings: exam.overallRankings || [] }, overallScore: exam.overallScore };
    const school = share.fields?.overallRank === false ? null : overallRank(projected, "school");
    const clazz = share.fields?.overallRank === false ? null : overallRank(projected, "class");
    return `<a class="history-row ${index === 0 ? "is-latest" : ""}" href="?view=timeline&exam=${encodeURIComponent(exam.id)}"><span><strong>${esc(exam.name)}</strong><small>${fmtDate(exam.date)} · ${examTypeLabel(exam.type)}${index === 0 ? " · 最新" : ""}</small></span><div class="history-coordinate"><span>${school?.rank ? `校第 ${school.rank} 名` : ""}</span><span>${clazz?.rank ? `班第 ${clazz.rank} 名` : ""}</span><span>${overallScore(projected) != null ? `${fmtNumber(overallScore(projected))} 分` : ""}</span></div><span class="row-chevron" aria-hidden="true">›</span></a>`;
  }).join("");
  return `<section class="public-reading-section public-timeline"><div class="section-label">时间轴</div><h2>每一次考试都可以打开</h2>${publicBaselineV081("timeline", exams, share)}${selected ? publicExamDetailV080(selected, share) : ""}<div class="history-list">${rows || `<div class="empty compact">暂未分享考试数据。</div>`}</div><p class="muted">页面只展示分享白名单中的字段。</p></section>`;
}

function renderPublicV080(result) {
  const data = result.data || {};
  app.classList.add("share-ink-root");
  const params = new URLSearchParams(location.search);
  const view = ["total", "subject", "timeline"].includes(params.get("view")) ? params.get("view") : "total";
  const subject = SUBJECTS.some(([key]) => key === params.get("subject")) ? params.get("subject") : "chinese";
  const selectedExamId = params.get("exam") || null;
  const latest = data.exams?.[0] || null;
  const school = rankByScope(latest?.overallRankings, "school");
  const clazz = rankByScope(latest?.overallRankings, "class");
  const latestSummary = examScoreSummary(latest);
  const totalText = latestSummary.kind === "official" ? `${fmtNumber(latestSummary.value)} 分` : latestSummary.kind === "calculated_complete" ? `六科合计 ${fmtNumber(latestSummary.value)}` : latestSummary.kind === "calculated_partial" ? `${latestSummary.recordedSubjects}/6 科小计 ${fmtNumber(latestSummary.subtotal)}` : latestSummary.kind === "absent" ? "缺考" : null;
  const coordinate = latest ? [result.share.fields?.overallRank === false ? null : school?.rank ? `校第 ${school.rank} 名` : null, result.share.fields?.overallRank === false ? null : clazz?.rank ? `班第 ${clazz.rank} 名` : null, result.share.fields?.overallScore === false ? null : totalText].filter(Boolean) : [];
  const meta = [data.student?.graduationYear ? `${data.student.graduationYear}届` : null, data.student?.schoolLabel, data.student?.className].filter(Boolean).map(esc).join(" · ");
  const total = `<section class="public-coordinate"><div class="public-mode">${result.share.mode === "snapshot" ? "只分享当前内容" : result.share.scope === "trajectory" ? "成长轨迹 · 持续更新" : "持续更新"}</div><h1>${esc(data.student?.displayName || "学生")}</h1><p>${meta}</p>${latest ? `<div class="exam-context"><strong>${esc(latest.name)}</strong><span>${fmtDate(latest.date)} · ${examTypeLabel(latest.type)}</span></div><div class="coordinate-row">${coordinate.length ? coordinate.map((item) => `<span>${esc(item)}</span>`).join("") : `<span>位置未分享</span>`}</div>${publicBaselineV081("total", data.exams || [], result.share)}<div class="subject-rows public-subjects">${publicSubjectRows(latest, result.share)}</div>` : `<div class="empty compact">暂未分享考试数据。</div>`}</section>`;
  const body = view === "subject" ? publicSubjectComparisonV080(data.exams || [], subject, result.share) : view === "timeline" ? publicTimelineV080(data.exams || [], selectedExamId, result.share) : total;
  app.innerHTML = `<main class="public-shell ink-share" data-share-view="${view}" data-exam-count="${data.exams?.length || 0}"><div class="public-brand">${brandMark()}<span>${PRODUCT_NAME} · 分享</span><i class="ink-share-flourish" aria-hidden="true"></i></div><div class="privacy-note">此页面由家庭主动分享 · 请勿未经允许转发</div>${publicViewNavV080(view, subject)}${body}</main><footer class="footer">分享地址可由家庭随时撤销</footer>`;
}

async function renderExternal(kind, locator) {
  try {
    const result = await api(`/api/share/${kind}/${encodeURIComponent(locator)}`);
    const data = result.data;
    renderPublicV080(result);
    return;
    const latest = data.exams?.[0] || null;
    const school = rankByScope(latest?.overallRankings, "school");
    const clazz = rankByScope(latest?.overallRankings, "class");
    const schoolPct = percentile(school?.rank, school?.participants);
    const meta = [data.student?.graduationYear ? `${data.student.graduationYear}届` : null, data.student?.schoolLabel, data.student?.className].filter(Boolean).map(esc).join(" · ");
    const coordinate = latest ? [school?.rank ? `校第 ${school.rank} 名` : null, clazz?.rank ? `班第 ${clazz.rank} 名` : null, latest.overallScore != null ? `${fmtNumber(latest.overallScore)} 分` : null].filter(Boolean) : [];
    app.innerHTML = `<main class="public-shell"><div class="public-brand">${brandMark()}<span>${PRODUCT_NAME} · 分享</span></div><div class="privacy-note">此页面由家庭主动分享 · 请勿未经允许转发</div><section class="public-coordinate"><div class="public-mode">${result.share.mode === "snapshot" ? "只分享当前内容" : "持续更新"}</div><h1>${esc(data.student?.displayName || "学生")}</h1><p>${meta}</p>${latest ? `<div class="exam-context"><strong>${esc(latest.name)}</strong><span>${fmtDate(latest.date)} · ${examTypeLabel(latest.type)}</span></div><div class="coordinate-row">${coordinate.length ? coordinate.map((item) => `<span>${esc(item)}</span>`).join("") : `<span>位置未分享</span>`}</div>${schoolPct != null || school?.participants ? `<div class="coordinate-note">${schoolPct != null ? `校前 ${fmtNumber(schoolPct)}%` : ""}${schoolPct != null && school?.participants ? " · " : ""}${school?.participants ? `本次共 ${school.participants} 人` : ""}</div>` : ""}<div class="subject-rows public-subjects">${publicSubjectRows(latest)}</div>` : `<div class="empty compact">暂未分享考试数据。</div>`}</section>${publicHistory(data.exams)}</main><footer class="footer">分享地址可由家庭随时撤销</footer>`;
  } catch (error) {
    app.innerHTML = `<main class="login-shell"><section class="login-card">${brandMark()}<h1>分享已失效</h1><p>${esc(error.message)}</p></section></main>`;
  }
}

async function bootstrap() {
  const path = location.pathname;
  if (path.startsWith("/share/")) return renderExternal("secret", path.slice("/share/".length));
  if (path.startsWith("/p/")) return renderExternal("public", path.slice("/p/".length));
  const params = new URLSearchParams(location.search);
  if (["total", "subject", "timeline"].includes(params.get("view"))) state.trajectoryView = params.get("view");
  if (params.get("exam")) state.selectedExamId = params.get("exam");
  window.addEventListener("popstate", () => {
    const next = new URLSearchParams(location.search);
    state.trajectoryView = ["total", "subject", "timeline"].includes(next.get("view")) ? next.get("view") : "total";
    state.selectedExamId = next.get("exam") || null;
    if (state.me) renderDashboard();
  });
  return loadPrivateApp();
}

bootstrap();
