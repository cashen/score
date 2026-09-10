import { comparisonEligibility, comparableRanking, percentile as corePercentile } from "./trajectory-core-v060.js";
import { examScoreSummary, subjectScore } from "./score-core-v090.js";

export const COORDINATE_SUBJECTS = Object.freeze([
  ["chinese", "语文"],
  ["math", "数学"],
  ["english", "英语"],
  ["physics", "物理"],
  ["chemistry", "化学"],
  ["biology", "生物"]
]);

const CHANGE_THRESHOLDS = Object.freeze({ percentile: 0.4, score: 1 });

function ranked(exam, key, scope) {
  const rankings = key ? exam?.subjects?.[key]?.rankings : exam?.overall?.rankings || exam?.overallRankings;
  return (rankings || []).find((item) => item?.scope === scope && (item.rank != null || item.participants != null)) || null;
}

function scoreDelta(current, previous, key) {
  const a = key ? subjectScore(current?.subjects?.[key]) : examScoreSummary(current).value;
  const b = key ? subjectScore(previous?.subjects?.[key]) : examScoreSummary(previous).value;
  return a != null && b != null ? { kind: "score", value: Number(a) - Number(b), current: a, previous: b } : null;
}

export function metricBetween(current, previous, key = null) {
  if (!current || !previous || comparisonEligibility(current, previous).status !== "comparable") return null;
  for (const scope of ["school", "class"]) {
    const a = ranked(current, key, scope);
    const b = ranked(previous, key, scope);
    if (!a?.rank || !b?.rank || !comparableRanking(a, b)) continue;
    const currentPct = corePercentile(a.rank, a.participants);
    const previousPct = corePercentile(b.rank, b.participants);
    if (currentPct != null && previousPct != null) {
      return { kind: "percentile", scope, value: previousPct - currentPct, current: currentPct, previous: previousPct };
    }
    return { kind: "rank", scope, value: b.rank - a.rank, current: a.rank, previous: b.rank };
  }
  return scoreDelta(current, previous, key);
}

export function changeDirection(metric) {
  if (!metric) return "baseline";
  const threshold = CHANGE_THRESHOLDS[metric.kind] ?? 0;
  if (metric.value > threshold) return "forward";
  if (metric.value < -threshold) return "backward";
  return "steady";
}

function sortedExams(exams) {
  return (Array.isArray(exams) ? exams : []).filter(Boolean).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function latestComparablePair(exams) {
  const list = sortedExams(exams);
  const latest = list[0] || null;
  if (!latest) return { list, latest: null, previous: null, eligibility: { status: "baseline", reason: "还没有考试记录" } };
  for (const candidate of list.slice(1)) {
    const eligibility = comparisonEligibility(latest, candidate);
    if (eligibility.status === "comparable") return { list, latest, previous: candidate, eligibility };
  }
  return { list, latest, previous: null, eligibility: { status: "baseline", reason: list.length > 1 ? "之前有考试，但没有找到口径足够一致的比较对象" : "还没有第二次可比考试" } };
}

function subjectDrivers(current, previous) {
  if (!current || !previous) return [];
  return COORDINATE_SUBJECTS.map(([key, label]) => ({ key, label, metric: metricBetween(current, previous, key) }))
    .filter((item) => item.metric)
    .sort((a, b) => Math.abs(b.metric.value) - Math.abs(a.metric.value))
    .slice(0, 3)
    .map((item) => ({ ...item, direction: changeDirection(item.metric) }));
}

function attentionSubject(exams) {
  const { list } = latestComparablePair(exams);
  if (list.length < 3) return null;
  const candidates = [];
  for (let index = 0; index < Math.min(list.length - 1, 3); index += 1) {
    const current = list[index];
    const previous = list[index + 1];
    if (comparisonEligibility(current, previous).status !== "comparable") continue;
    for (const [key, label] of COORDINATE_SUBJECTS) {
      const metric = metricBetween(current, previous, key);
      if (!metric) continue;
      candidates.push({ key, label, direction: changeDirection(metric), value: metric.value });
    }
  }
  const grouped = new Map();
  for (const item of candidates) {
    const row = grouped.get(item.key) || { key: item.key, label: item.label, backward: 0, forward: 0, steady: 0 };
    row[item.direction] += 1;
    grouped.set(item.key, row);
  }
  return [...grouped.values()]
    .filter((item) => item.backward >= 2)
    .sort((a, b) => b.backward - a.backward || b.forward - a.forward)[0] || null;
}

function currentPosition(latest) {
  if (!latest) return null;
  const school = ranked(latest, null, "school");
  const clazz = ranked(latest, null, "class");
  const score = examScoreSummary(latest);
  return {
    school: school ? { rank: school.rank ?? null, participants: school.participants ?? null, percentile: corePercentile(school.rank, school.participants) } : null,
    class: clazz ? { rank: clazz.rank ?? null, participants: clazz.participants ?? null } : null,
    score: score.value == null ? null : { value: score.value, kind: score.kind }
  };
}

export function analyzeCoordinate(exams) {
  const { list, latest, previous, eligibility } = latestComparablePair(exams);
  if (!latest) return {
    status: "empty", latest: null, previous: null, position: null, overall: null,
    drivers: [], attention: null, boundary: "先记录第一场考试，建立当前坐标。"
  };
  const overall = previous ? metricBetween(latest, previous) : null;
  const drivers = subjectDrivers(latest, previous);
  const attention = attentionSubject(list);
  return {
    status: previous ? "comparable" : "baseline",
    latest,
    previous,
    position: currentPosition(latest),
    overall: overall ? { ...overall, direction: changeDirection(overall) } : null,
    drivers,
    attention,
    boundary: previous ? eligibility.reason : eligibility.reason,
    comparedExamCount: previous ? 2 : 1
  };
}

function fmt(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1).replace(/\.0$/, "") : "—";
}

function positionText(position) {
  if (!position) return "位置待补";
  const parts = [];
  if (position.school?.percentile != null) parts.push(`校内前 ${fmt(position.school.percentile)}%`);
  else if (position.school?.rank != null) parts.push(`校第 ${position.school.rank} 名`);
  if (position.class?.rank != null) parts.push(`班第 ${position.class.rank} 名`);
  if (position.score?.value != null) parts.push(`${fmt(position.score.value)} 分`);
  return parts.join(" · ") || "位置待补";
}

function changeText(overall) {
  if (!overall) return "先积累第二场同口径考试";
  const direction = overall.direction;
  if (overall.kind === "percentile") {
    if (direction === "forward") return `校内位置向前 ${fmt(Math.abs(overall.value))} 个百分点`;
    if (direction === "backward") return `校内位置向后 ${fmt(Math.abs(overall.value))} 个百分点`;
    return "整体位置和上一次基本接近";
  }
  if (overall.kind === "rank") {
    if (direction === "forward") return `位置向前 ${Math.abs(overall.value)} 名`;
    if (direction === "backward") return `位置向后 ${Math.abs(overall.value)} 名`;
    return "整体位置和上一次基本接近";
  }
  if (direction === "forward") return `分数高 ${fmt(Math.abs(overall.value))} 分`;
  if (direction === "backward") return `分数低 ${fmt(Math.abs(overall.value))} 分`;
  return "分数和上一次基本接近";
}

function driverText(driver) {
  const metric = driver.metric;
  const direction = driver.direction;
  if (metric.kind === "percentile") return `${direction === "forward" ? "位置向前" : direction === "backward" ? "位置向后" : "基本接近"} ${fmt(Math.abs(metric.value))} 个百分点`;
  if (metric.kind === "rank") return `${direction === "forward" ? "位置向前" : direction === "backward" ? "位置向后" : "基本接近"} ${Math.abs(metric.value)} 名`;
  return `${direction === "forward" ? "高" : direction === "backward" ? "低" : "接近"} ${fmt(Math.abs(metric.value))} 分`;
}

function addStyles() {
  if (document.querySelector("style[data-coordinate-insight='v100']")) return;
  const style = document.createElement("style");
  style.dataset.coordinateInsight = "v100";
  style.textContent = `.coordinate-insight{margin-top:20px}.coordinate-insight-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:12px}.coordinate-insight-box{border:1px solid var(--border,#ddd);border-radius:14px;padding:16px;background:var(--surface,#fff)}.coordinate-insight-box small{display:block;color:var(--muted,#6f716f);margin-bottom:6px}.coordinate-insight-box strong{display:block;font-size:18px;line-height:1.4}.coordinate-insight-drivers{display:grid;gap:8px;margin-top:12px}.coordinate-insight-driver{display:grid;grid-template-columns:56px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--border,#ddd)}.coordinate-insight-driver:first-child{border-top:0}.coordinate-insight-driver b{font-size:14px}.coordinate-insight-driver span{font-size:13px;color:var(--muted,#6f716f)}.coordinate-insight-boundary{margin:12px 0 0;color:var(--muted,#6f716f);font-size:13px}.coordinate-insight-action{margin-top:14px}.coordinate-insight-action a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border:1px solid var(--border,#bbb);border-radius:10px;text-decoration:none}.coordinate-insight-attention{margin-top:12px;padding:12px 14px;border-left:3px solid currentColor;background:color-mix(in srgb,currentColor 6%,transparent)}@media (max-width:720px){.coordinate-insight-grid{grid-template-columns:1fr}.coordinate-insight-driver{grid-template-columns:48px 1fr}.coordinate-insight-driver span{grid-column:2}.coordinate-insight-action a{width:100%;justify-content:center}}`;
  document.head.append(style);
}

function findCurrentStudentId(me) {
  const selected = document.querySelector("#student-select")?.value;
  return selected || me?.students?.[0]?.id || null;
}

async function fetchExams(studentId) {
  const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/exams`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.exams) ? payload.exams : null;
}

function renderInsight(result) {
  const existing = document.querySelector("[data-coordinate-insight]");
  const anchor = document.querySelector(".coordinate-hero");
  if (!anchor?.isConnected) {
    existing?.remove();
    return;
  }
  existing?.remove();
  const drivers = result.drivers.length ? `<div class="coordinate-insight-drivers">${result.drivers.map((driver) => `<div class="coordinate-insight-driver"><b>${driver.label}</b><div><strong>${driverText(driver)}</strong><span>与上一次可比考试相比</span></div></div>`).join("")}</div>` : `<p class="coordinate-insight-boundary">目前没有足够的同口径数据判断哪一科变化更明显。</p>`;
  const attention = result.attention ? `<div class="coordinate-insight-attention"><small>下一次值得继续观察</small><strong>${result.attention.label}</strong><span>最近几次同口径比较中，这门课多次向后。</span></div>` : "";
  const action = result.attention ? `<div class="coordinate-insight-action"><a href="?view=subject&subject=${encodeURIComponent(result.attention.key)}">打开${result.attention.label}历次记录</a></div>` : "";
  const section = document.createElement("section");
  section.className = "reading-section coordinate-insight";
  section.dataset.coordinateInsight = "v100";
  section.innerHTML = `<div class="section-head-simple"><div><div class="section-label">坐标判断</div><h2>${result.status === "empty" ? "先建立第一条坐标" : "把这次变化看懂"}</h2></div></div><div class="coordinate-insight-grid"><div class="coordinate-insight-box"><small>现在在哪</small><strong>${positionText(result.position)}</strong>${result.latest ? `<span>${result.latest.name} · ${String(result.latest.date || "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2月$3日")}</span>` : ""}</div><div class="coordinate-insight-box"><small>最近怎么变</small><strong>${changeText(result.overall)}</strong><span>${result.previous ? `比较：${result.previous.name}` : result.boundary}</span></div></div>${drivers}${attention}${action}<p class="coordinate-insight-boundary">这里描述的是考试记录中的相对位置变化，不代表能力提高或下降。</p>`;
  anchor.insertAdjacentElement("afterend", section);
}

let bootKey = "";
let bootPending = false;

async function boot() {
  if (typeof document === "undefined") return;
  addStyles();
  if (bootPending) return;
  const anchor = document.querySelector(".coordinate-hero");
  if (!anchor) return;
  bootPending = true;
  try {
    const meResponse = await fetch("/api/me", { credentials: "same-origin", cache: "no-store" });
    if (!meResponse.ok) return;
    const me = await meResponse.json().catch(() => null);
    const studentId = findCurrentStudentId(me);
    if (!studentId) return;
    const exams = await fetchExams(studentId);
    if (!exams) return;
    const key = `${studentId}:${exams.map((exam) => `${exam.id}:${exam.revision}`).join(",")}`;
    if (key === bootKey && document.querySelector("[data-coordinate-insight]")) return;
    bootKey = key;
    renderInsight(analyzeCoordinate(exams));
  } finally {
    bootPending = false;
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const observer = new MutationObserver(() => {
    if (document.querySelector(".coordinate-hero") && !document.querySelector("[data-coordinate-insight]")) boot();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
}
