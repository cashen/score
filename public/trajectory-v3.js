const V3_SUBJECTS = [
  ["chinese", "语文"],
  ["math", "数学"],
  ["english", "英语"],
  ["physics", "物理"],
  ["chemistry", "化学"],
  ["biology", "生物"]
];

const V3_LEVEL_LABELS = {
  school: "校内",
  alliance: "校际/联盟",
  district: "区县",
  city: "市级",
  province: "省级",
  other: "其他"
};

let v3Me = null;
let v3Enhancing = false;
let v3FetchWrapped = false;
const v3NativeFetch = window.fetch.bind(window);

function v3Esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function v3Date(value) {
  const match = String(value || "").match(/^\d{4}-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}/${match[2]}` : String(value || "—");
}

function v3Rank(rankings, scope) {
  return (rankings || []).find((item) => item.scope === scope && item.rank != null) || null;
}

function v3Pct(ranking) {
  const rank = ranking?.rank;
  const total = ranking?.participants;
  if (!Number.isInteger(rank) || !Number.isInteger(total) || rank < 1 || total < rank) return null;
  return Math.round((rank / total) * 1000) / 10;
}

function v3Fmt(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function v3Score(subject) {
  return subject?.finalScore ?? subject?.rawScore ?? null;
}

function v3RankText(ranking) {
  if (!ranking?.rank) return "—";
  return ranking.participants ? `${ranking.rank} / ${ranking.participants}` : `第 ${ranking.rank} 名`;
}

function v3PositionText(ranking, prefix = "") {
  if (!ranking?.rank) return "—";
  const pct = v3Pct(ranking);
  if (pct != null) return `${prefix}前 ${v3Fmt(pct)}%`;
  return `${prefix}第 ${ranking.rank} 名`;
}

function v3Subject(exam, key) {
  return exam?.subjects?.[key] || {};
}

function v3OverallRanking(exam, scope) {
  return v3Rank(exam?.overall?.rankings || exam?.overallRankings, scope);
}

function v3SubjectRanking(exam, key, scope) {
  return v3Rank(v3Subject(exam, key)?.rankings, scope);
}

async function v3Api(path, options = {}) {
  const response = await fetch(path, { credentials: "same-origin", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `请求失败 (${response.status})`);
  return payload;
}

function v3InstallFetchBridge() {
  if (v3FetchWrapped) return;
  v3FetchWrapped = true;
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
    if ((method === "POST" || method === "PUT") && /\/api\/students\/[^/]+\/exams(?:\/[^/?]+)?(?:\?|$)/.test(url) && typeof init.body === "string") {
      const form = document.querySelector("#exam-form");
      if (form) {
        try {
          const body = JSON.parse(init.body);
          const series = form.querySelector("[name='comparisonSeries']")?.value?.trim() || null;
          const level = form.querySelector("[name='comparisonLevel']")?.value || null;
          body.comparison = { series, level: level || null };
          init = { ...init, body: JSON.stringify(body) };
        } catch {}
      }
    }
    return v3NativeFetch(input, init);
  };
}

function v3Perspective() {
  try {
    return localStorage.getItem("score:v030:perspective") === "student" ? "student" : "parent";
  } catch {
    return "parent";
  }
}

function v3SetPerspective(value) {
  try { localStorage.setItem("score:v030:perspective", value); } catch {}
}

function v3SelectedSubject() {
  try {
    const key = localStorage.getItem("score:v030:subject");
    return V3_SUBJECTS.some(([candidate]) => candidate === key) ? key : "math";
  } catch {
    return "math";
  }
}

function v3SetSubject(value) {
  try { localStorage.setItem("score:v030:subject", value); } catch {}
}

function v3ComparisonSet(exams) {
  const recent = (exams || []).slice(0, 6);
  const latest = recent[0];
  if (!latest) return { exams: [], caveat: "还没有考试记录。", mode: "none" };
  const series = latest.comparison?.series;
  if (series) {
    const same = (exams || []).filter((exam) => exam.comparison?.series === series).slice(0, 6);
    if (same.length >= 2) {
      return { exams: same, mode: "series", caveat: `优先比较同一可比组“${series}”。` };
    }
  }
  const level = latest.comparison?.level;
  const sameType = (exams || []).filter((exam) => exam.type === latest.type && (!level || !exam.comparison?.level || exam.comparison.level === level)).slice(0, 6);
  if (sameType.length >= 2) {
    return { exams: sameType, mode: "type", caveat: "未形成同一可比组，暂按相同考试类型观察；试卷难度仍可能不同。" };
  }
  return { exams: recent, mode: "mixed", caveat: "最近考试口径可能不同，优先看相对位置；分数变化只作辅助，不直接等同于能力变化。" };
}

function v3CommonMetric(latest, previous, key, overall = false) {
  const getSchool = (exam) => overall ? v3OverallRanking(exam, "school") : v3SubjectRanking(exam, key, "school");
  const getClass = (exam) => overall ? v3OverallRanking(exam, "class") : v3SubjectRanking(exam, key, "class");
  const currentSchool = getSchool(latest);
  const previousSchool = getSchool(previous);
  const currentPct = v3Pct(currentSchool);
  const previousPct = v3Pct(previousSchool);
  if (currentPct != null && previousPct != null) {
    return { kind: "percentile", current: currentPct, previous: previousPct, delta: previousPct - currentPct, detail: `前 ${v3Fmt(previousPct)}% → 前 ${v3Fmt(currentPct)}%` };
  }
  if (currentSchool?.rank != null && previousSchool?.rank != null) {
    return { kind: "school-rank", current: currentSchool.rank, previous: previousSchool.rank, delta: previousSchool.rank - currentSchool.rank, detail: `校第 ${previousSchool.rank} → 第 ${currentSchool.rank}` };
  }
  const currentClass = getClass(latest);
  const previousClass = getClass(previous);
  if (currentClass?.rank != null && previousClass?.rank != null) {
    return { kind: "class-rank", current: currentClass.rank, previous: previousClass.rank, delta: previousClass.rank - currentClass.rank, detail: `班第 ${previousClass.rank} → 第 ${currentClass.rank}` };
  }
  if (!overall) {
    const currentScore = v3Score(v3Subject(latest, key));
    const previousScore = v3Score(v3Subject(previous, key));
    if (currentScore != null && previousScore != null) {
      return { kind: "score", current: currentScore, previous: previousScore, delta: currentScore - previousScore, detail: `${previousScore} → ${currentScore} 分` };
    }
  }
  return null;
}

function v3Direction(metric) {
  if (!metric) return { label: "数据不足", tone: "neutral" };
  const threshold = metric.kind === "percentile" ? 0.4 : metric.kind === "score" ? 1 : 0;
  if (metric.delta > threshold) return { label: metric.kind === "score" ? "分数上升" : "向前", tone: "up" };
  if (metric.delta < -threshold) return { label: metric.kind === "score" ? "分数下降" : "向后", tone: "down" };
  return { label: metric.kind === "score" ? "分数接近" : "基本稳定", tone: "neutral" };
}

function v3MetricSeries(exams, key, kind) {
  const result = [];
  for (const exam of [...(exams || [])].reverse()) {
    const school = v3SubjectRanking(exam, key, "school");
    const clazz = v3SubjectRanking(exam, key, "class");
    const value = kind === "percentile" ? v3Pct(school)
      : kind === "school-rank" ? school?.rank
      : kind === "class-rank" ? clazz?.rank
      : v3Score(v3Subject(exam, key));
    if (Number.isFinite(value)) result.push(value);
  }
  return result;
}

function v3Stability(exams, key) {
  const pct = v3MetricSeries(exams, key, "percentile");
  if (pct.length >= 3) {
    const swing = Math.max(...pct) - Math.min(...pct);
    return swing <= 3 ? "较稳定" : swing <= 8 ? "有波动" : "波动较大";
  }
  const ranks = v3MetricSeries(exams, key, "school-rank");
  if (ranks.length >= 3) {
    const sorted = [...ranks].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1;
    const swing = Math.max(...ranks) - Math.min(...ranks);
    return swing <= Math.max(5, median * 0.12) ? "较稳定" : "有波动";
  }
  return "待更多位置数据";
}

function v3CurrentPosition(exam, key) {
  const school = v3SubjectRanking(exam, key, "school");
  if (school?.rank != null) return v3PositionText(school, "校");
  const clazz = v3SubjectRanking(exam, key, "class");
  if (clazz?.rank != null) return v3PositionText(clazz, "班");
  const score = v3Score(v3Subject(exam, key));
  return score != null ? `${score} 分` : "—";
}

function v3SubjectSwitch(selected, compact = false) {
  return `<div class="v3-subject-switch ${compact ? "is-compact" : ""}" role="tablist" aria-label="切换单科">${V3_SUBJECTS.map(([key, label]) => `<button type="button" role="tab" aria-selected="${key === selected}" class="v3-subject-button ${key === selected ? "is-active" : ""}" data-v3-subject="${key}">${label}</button>`).join("")}</div>`;
}

function v3SubjectHistory(exams, key) {
  const label = V3_SUBJECTS.find(([candidate]) => candidate === key)?.[1] || key;
  const comparable = v3ComparisonSet(exams);
  const working = comparable.exams.length ? comparable.exams : (exams || []).slice(0, 6);
  const latest = working[0] || exams?.[0];
  const previous = working[1] || null;
  const metric = previous ? v3CommonMetric(latest, previous, key) : null;
  const direction = v3Direction(metric);
  const school = v3SubjectRanking(latest, key, "school");
  const clazz = v3SubjectRanking(latest, key, "class");
  const score = v3Score(v3Subject(latest, key));
  const points = [...working].reverse();
  const rows = points.map((exam) => {
    const subject = v3Subject(exam, key);
    const examSchool = v3SubjectRanking(exam, key, "school");
    const examClass = v3SubjectRanking(exam, key, "class");
    const pct = v3Pct(examSchool);
    return `<article class="v3-subject-point"><div><small>${v3Esc(v3Date(exam.date))}</small><strong>${v3Esc(exam.name || "未命名考试")}</strong></div><div><small>分数</small><b>${v3Score(subject) ?? "—"}</b></div><div><small>学校位置</small><b>${pct != null ? `前 ${v3Fmt(pct)}%` : v3RankText(examSchool)}</b></div><div><small>班级位置</small><b>${v3RankText(examClass)}</b></div></article>`;
  }).join("");
  const comparisonText = previous
    ? `<strong class="v3-direction is-${direction.tone}">${direction.label}</strong><span>${v3Esc(metric?.detail || "连续两次可比数据不足")}</span>`
    : `<strong class="v3-direction">等待下一次考试</strong><span>有第二次记录后开始形成变化判断。</span>`;
  return `<section class="card card-pad v3-subject-history" data-v3-subject-history="${key}"><div class="section-head"><div><div class="eyebrow">${v3Esc(label)}轨迹</div><h2>同一科目，放回时间里看</h2></div><span class="badge">${points.length} 次可见记录</span></div>${v3SubjectSwitch(key)}<div class="v3-current-grid"><div><small>当前分数</small><strong>${score ?? "—"}</strong></div><div><small>学校位置</small><strong>${v3PositionText(school)}</strong></div><div><small>班级位置</small><strong>${v3PositionText(clazz)}</strong></div><div><small>稳定性</small><strong>${v3Stability(working, key)}</strong></div></div><div class="v3-latest-compare"><small>最近一次和可比上一次</small>${comparisonText}</div><p class="v3-caveat">${v3Esc(comparable.caveat)} 不同考试难度不同，单看分数不能直接判断相对位置变化。</p><div class="v3-subject-history-scroll" tabindex="0" aria-label="${v3Esc(label)}历次考试轨迹">${rows || `<div class="empty">这门科目还没有可展示的数据。</div>`}</div></section>`;
}

function v3SixMap(exams, perspective = "parent") {
  const comparable = v3ComparisonSet(exams);
  const latest = comparable.exams[0] || exams?.[0];
  const previous = comparable.exams[1] || null;
  const rows = V3_SUBJECTS.map(([key, label]) => {
    const metric = previous ? v3CommonMetric(latest, previous, key) : null;
    const direction = v3Direction(metric);
    return { key, label, metric, direction, stability: v3Stability(comparable.exams.length ? comparable.exams : exams, key), current: v3CurrentPosition(latest, key) };
  });
  const relative = rows.filter((item) => item.metric && item.metric.kind !== "score");
  const positive = relative.filter((item) => item.metric.delta > 0).sort((a, b) => b.metric.delta - a.metric.delta);
  const negative = relative.filter((item) => item.metric.delta < 0).sort((a, b) => a.metric.delta - b.metric.delta);
  let summary = "还需要更多连续的单科排名数据，才能判断变化来源。";
  if (perspective === "student") {
    if (positive.length) summary = `最近变化较明显：${positive.slice(0, 2).map((item) => item.label).join("、")}在向前。`;
    else if (negative.length) summary = `${negative[0].label}最近位置向后，先回看具体考试和失分点。`;
  } else if (perspective === "teacher") {
    if (positive.length || negative.length) summary = `${positive.length ? `向前：${positive.slice(0, 2).map((item) => item.label).join("、")}` : "暂无明显向前科目"}${negative.length ? `；建议核对：${negative.slice(0, 2).map((item) => item.label).join("、")}` : ""}。`;
  } else {
    if (negative.length) summary = `值得留意：${negative.slice(0, 2).map((item) => item.label).join("、")}最近相对位置向后。先看连续性，不用单次考试下结论。`;
    else if (positive.length) summary = `最近整体变化里，${positive.slice(0, 2).map((item) => item.label).join("、")}的相对位置更明显向前。`;
  }
  return `<section class="card card-pad v3-six-map" data-v3-six-map><div class="section-head"><div><div class="eyebrow">六科变化</div><h2>${perspective === "student" ? "哪科正在改变我的位置" : perspective === "teacher" ? "六科横向扫描" : "哪些科目值得留意"}</h2></div><span class="badge">相对位置优先</span></div><div class="v3-six-summary">${v3Esc(summary)}</div><div class="v3-six-grid">${rows.map((item) => `<article class="v3-six-item"><div class="v3-six-title"><strong>${item.label}</strong><span class="v3-direction is-${item.direction.tone}">${item.direction.label}</span></div><div class="v3-six-position">${v3Esc(item.current)}</div><small>${v3Esc(item.metric?.detail || "缺少连续可比数据")}</small><em>${v3Esc(item.stability)}</em></article>`).join("")}</div><p class="v3-caveat">${v3Esc(comparable.caveat)} 判断优先级：校百分位/校排名 → 班排名 → 分数；只有分数时不把变化包装成“进步/退步”。</p></section>`;
}

function v3OverallSummary(exams, perspective = "parent") {
  if (!exams?.length) return "";
  const comparable = v3ComparisonSet(exams);
  const latest = comparable.exams[0] || exams[0];
  const previous = comparable.exams[1] || null;
  const school = v3OverallRanking(latest, "school");
  const clazz = v3OverallRanking(latest, "class");
  const metric = previous ? v3CommonMetric(latest, previous, null, true) : null;
  const direction = v3Direction(metric);
  const prompt = perspective === "student" ? ["我现在在哪", "最近有没有变化", "哪科在变"] : ["孩子现在在哪", "最近有没有变化", "哪些值得留意"];
  return `<section class="card card-pad v3-overall-summary" data-v3-overall><div class="section-head"><div><div class="eyebrow">多维轨迹</div><h2>${perspective === "student" ? "先看位置，再看变化" : "先看发生了什么，再决定要不要介入"}</h2></div><span class="badge">${exams.length} 次记录</span></div><div class="v3-summary-grid"><article><small>${prompt[0]}</small><strong>${school?.rank ? v3PositionText(school, "校") : clazz?.rank ? v3PositionText(clazz, "班") : "位置数据不足"}</strong><span>${school?.participants ? v3RankText(school) : school?.rank ? "总人数未填，仅看名次" : ""}</span></article><article><small>${prompt[1]}</small><strong class="v3-direction is-${direction.tone}">${previous ? direction.label : "等待第二次考试"}</strong><span>${v3Esc(metric?.detail || comparable.caveat)}</span></article><article><small>${prompt[2]}</small><strong>${perspective === "student" ? "往下看六科变化" : "看连续变化，不看单次情绪"}</strong><span>系统优先用排名/百分位解释，不把不同难度试卷的分数机械横比。</span></article></div></section>`;
}

async function v3Context() {
  v3Me = v3Me || await v3Api("/api/me");
  const id = document.querySelector("#student-select")?.value || v3Me.students?.[0]?.id;
  return { me: v3Me, student: v3Me.students?.find((item) => item.id === id) || v3Me.students?.[0] };
}

async function v3CurrentExams(studentId) {
  const result = await v3Api(`/api/students/${studentId}/exams`);
  return result.exams || [];
}

function v3BindPrivate(section, exams) {
  section.querySelectorAll("[data-v3-perspective]").forEach((button) => button.addEventListener("click", () => {
    v3SetPerspective(button.dataset.v3Perspective);
    section.replaceWith(v3PrivateNode(exams));
  }));
  section.querySelectorAll("[data-v3-subject]").forEach((button) => button.addEventListener("click", () => {
    v3SetSubject(button.dataset.v3Subject);
    section.replaceWith(v3PrivateNode(exams));
  }));
}

function v3PrivateNode(exams) {
  const perspective = v3Perspective();
  const subject = v3SelectedSubject();
  const holder = document.createElement("div");
  holder.className = "v3-private-trajectory";
  holder.dataset.v3PrivateTrajectory = "1";
  holder.innerHTML = `<div class="v3-perspective-bar"><div><strong>阅读视角</strong><small>${perspective === "student" ? "学生：我在哪、哪科在变" : "家长：发生了什么、什么值得留意"}</small></div><div class="v3-segmented"><button type="button" class="${perspective === "student" ? "is-active" : ""}" data-v3-perspective="student">学生</button><button type="button" class="${perspective === "parent" ? "is-active" : ""}" data-v3-perspective="parent">家长</button></div></div>${v3OverallSummary(exams, perspective)}${v3SubjectHistory(exams, subject)}${v3SixMap(exams, perspective)}`;
  queueMicrotask(() => v3BindPrivate(holder, exams));
  return holder;
}

async function v3EnhancePrivate() {
  const active = document.querySelector(".tab.active")?.dataset.tab;
  if (active === "overview") {
    const { student } = await v3Context();
    if (!student) return;
    const exams = await v3CurrentExams(student.id);
    document.querySelector("[data-trajectory-v2]")?.remove();
    if (!document.querySelector("[data-v3-private-trajectory]")) {
      const anchor = document.querySelector("main.container .hero") || document.querySelector("main.container .card");
      if (anchor) anchor.insertAdjacentElement("afterend", v3PrivateNode(exams));
    }
  }
  if (active === "sharing") v3EnhanceTeacherPresets();
}

function v3ApplyTeacherPreset(prefix, button) {
  const trajectory = document.querySelector(`input[name='${prefix}-scope-v2'][value='trajectory']`);
  if (trajectory && !trajectory.disabled) {
    trajectory.checked = true;
    trajectory.dispatchEvent(new Event("change", { bubbles: true }));
  }
  for (const key of ["displayName", "graduationYear", "overallScore", "overallRank", "subjectScores", "subjectRanks", "history"]) {
    const input = document.querySelector(`[name='${prefix}-${key}']`);
    if (input) input.checked = true;
  }
  for (const key of ["school", "className"]) {
    const input = document.querySelector(`[name='${prefix}-${key}']`);
    if (input) input.checked = false;
  }
  button.classList.add("is-active");
  button.textContent = "老师查看预设已应用";
  const note = button.closest(".share-card")?.querySelector("[data-v3-teacher-note]");
  if (note) note.textContent = "已选择总体与单科成绩/排名/历史；默认不带学校、班级身份信息，需要时可手动勾选。家庭备注永不分享。";
}

function v3EnhanceTeacherPresets() {
  document.querySelectorAll(".share-scope-v2").forEach((box) => {
    if (box.querySelector("[data-v3-teacher-preset]")) return;
    const prefix = box.dataset.shareScopeBox;
    const wrap = document.createElement("div");
    wrap.className = "v3-teacher-preset";
    wrap.innerHTML = `<button type="button" class="btn btn-outline btn-small" data-v3-teacher-preset="${v3Esc(prefix)}">给老师看</button><small data-v3-teacher-note>一键选择老师最需要的学业轨迹字段；默认不分享学校和班级身份信息。</small>`;
    box.append(wrap);
    wrap.querySelector("button")?.addEventListener("click", (event) => v3ApplyTeacherPreset(prefix, event.currentTarget));
  });
}

function v3ExternalOverview(exams) {
  return `${v3OverallSummary(exams, "teacher")}<div class="v3-external-hint">可以切到“单科”查看某一科的历史，也可以切到“六科对比”快速扫描变化来源。</div>`;
}

function v3ExternalPanel(section, exams, view, subject) {
  const panel = section.querySelector("[data-v3-external-panel]");
  if (!panel) return;
  section.querySelectorAll("[data-v3-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.v3View === view));
  if (view === "subject") panel.innerHTML = v3SubjectHistory(exams, subject);
  else if (view === "compare") panel.innerHTML = v3SixMap(exams, "teacher");
  else panel.innerHTML = v3ExternalOverview(exams);
  panel.querySelectorAll("[data-v3-subject]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.v3Subject;
    history.replaceState(null, "", `${location.pathname}#subject-${key}`);
    v3ExternalPanel(section, exams, "subject", key);
  }));
}

function v3InitialExternalView() {
  const hash = location.hash || "";
  const match = hash.match(/^#subject-([a-z]+)$/);
  if (match && V3_SUBJECTS.some(([key]) => key === match[1])) return { view: "subject", subject: match[1] };
  if (hash === "#compare") return { view: "compare", subject: "math" };
  return { view: "overview", subject: "math" };
}

async function v3EnhanceExternal() {
  const path = location.pathname;
  const kind = path.startsWith("/share/") ? "secret" : path.startsWith("/p/") ? "public" : null;
  if (!kind || !document.querySelector(".public-shell") || document.querySelector("[data-v3-external]")) return Boolean(kind);
  const locator = kind === "secret" ? path.slice(7) : path.slice(3);
  try {
    const result = await v3Api(`/api/share/${kind}/${encodeURIComponent(locator)}`);
    if (result.share?.scope !== "trajectory" || (result.data?.exams || []).length < 2) return true;
    const exams = result.data.exams;
    document.querySelector("[data-trajectory-v2]")?.remove();
    const first = document.querySelector(".public-shell > .card");
    if (!first) return true;
    const section = document.createElement("section");
    section.className = "v3-external-trajectory";
    section.dataset.v3External = "1";
    section.innerHTML = `<div class="v3-external-nav" role="tablist" aria-label="轨迹查看维度"><button type="button" data-v3-view="overview">总体</button><button type="button" data-v3-view="subject">单科</button><button type="button" data-v3-view="compare">六科对比</button></div><div data-v3-external-panel></div>`;
    first.insertAdjacentElement("afterend", section);
    const initial = v3InitialExternalView();
    section.querySelectorAll("[data-v3-view]").forEach((button) => button.addEventListener("click", () => {
      const view = button.dataset.v3View;
      history.replaceState(null, "", `${location.pathname}${view === "compare" ? "#compare" : view === "overview" ? "#overview" : `#subject-${initial.subject}`}`);
      v3ExternalPanel(section, exams, view, initial.subject);
    }));
    v3ExternalPanel(section, exams, initial.view, initial.subject);
  } catch {}
  return true;
}

async function v3EnhanceExamForm() {
  const form = document.querySelector("#exam-form");
  if (!form || form.dataset.v3Comparison === "1") return;
  form.dataset.v3Comparison = "1";
  const block = document.createElement("div");
  block.className = "v3-comparison-fields";
  block.innerHTML = `<div class="field"><label>可比组（可不填）</label><input name="comparisonSeries" maxlength="60" placeholder="例如 2027届辽宁模考"><small>同一系列考试填写同一个名字，系统会优先在这一组里比较。</small></div><div class="field"><label>考试层级（可不填）</label><select name="comparisonLevel"><option value="">未标注</option>${Object.entries(V3_LEVEL_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><small>用于提醒不同口径考试不要机械横比。</small></div>`;
  form.querySelector(".form-grid")?.insertAdjacentElement("afterend", block);
  try {
    const { student } = await v3Context();
    const exams = student ? await v3CurrentExams(student.id) : [];
    const name = form.querySelector("[name='name']")?.value;
    const date = form.querySelector("[name='date']")?.value;
    const existing = exams.find((exam) => exam.name === name && exam.date === date);
    if (existing?.comparison) {
      const series = block.querySelector("[name='comparisonSeries']");
      const level = block.querySelector("[name='comparisonLevel']");
      if (series && !series.value) series.value = existing.comparison.series || "";
      if (level && !level.value) level.value = existing.comparison.level || "";
    }
  } catch {}
}

async function v3Enhance() {
  if (v3Enhancing) return;
  v3Enhancing = true;
  try {
    if (await v3EnhanceExternal()) return;
    if (document.querySelector("main.container .tabs")) await v3EnhancePrivate();
  } catch {} finally {
    v3Enhancing = false;
  }
}

v3InstallFetchBridge();

const v3App = document.querySelector("#app");
if (v3App) new MutationObserver(() => queueMicrotask(v3Enhance)).observe(v3App, { childList: true });

const v3Body = document.body;
if (v3Body) new MutationObserver(() => {
  if (document.querySelector("#exam-form")) queueMicrotask(v3EnhanceExamForm);
}).observe(v3Body, { childList: true });

v3Enhance();
v3EnhanceExamForm();
