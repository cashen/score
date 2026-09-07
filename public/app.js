const SUBJECTS = [
  ["chinese", "语文", 150],
  ["math", "数学", 150],
  ["english", "英语", 150],
  ["physics", "物理", 100],
  ["chemistry", "化学", 100],
  ["biology", "生物", 100]
];

const state = {
  me: null,
  csrf: null,
  student: null,
  exams: [],
  shares: [],
  tab: "overview",
  editingExam: null,
  notice: null
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

function percentile(rank, participants) {
  if (!Number.isInteger(rank) || !Number.isInteger(participants) || rank < 1 || participants < rank) return null;
  return Math.round((rank / participants) * 1000) / 10;
}

function rankByScope(rankings, scope) {
  return (rankings || []).find((item) => item.scope === scope && item.rank && item.participants) || null;
}

function scoreOf(subject) {
  if (!subject) return null;
  return subject.finalScore ?? subject.rawScore ?? null;
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (state.csrf && !["GET", "HEAD"].includes((options.method || "GET").toUpperCase())) headers.set("x-score-csrf", state.csrf);
  const response = await fetch(path, { credentials: "same-origin", ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `请求失败 (${response.status})`);
    error.status = response.status;
    error.code = payload.error;
    error.current = payload.current;
    throw error;
  }
  return payload;
}

function overallScore(exam) {
  return exam?.overall?.officialScore ?? exam?.overall?.calculatedScore ?? null;
}

function latestExam() {
  return state.exams[0] || null;
}

function emptyRank(label) {
  return `<div class="rank-card"><small>${label}</small><strong>—</strong><small>尚无排名</small></div>`;
}

function rankCard(label, ranking) {
  if (!ranking) return emptyRank(label);
  const pct = percentile(ranking.rank, ranking.participants);
  return `<div class="rank-card"><small>${label}</small><strong>${ranking.rank} / ${ranking.participants}</strong><small>${pct == null ? "" : `前 ${pct}%`}${ranking.label ? ` · ${esc(ranking.label)}` : ""}</small></div>`;
}

function trendHtml() {
  const points = state.exams.slice(0, 6).reverse().map((exam) => {
    const ranking = rankByScope(exam.overall?.rankings, "school");
    const pct = ranking ? percentile(ranking.rank, ranking.participants) : null;
    return { exam, pct };
  });
  const valid = points.filter((p) => p.pct != null);
  if (!valid.length) return `<div class="empty">还没有足够的学校排名数据形成趋势。</div>`;
  const max = Math.max(...valid.map((p) => p.pct), 1);
  return `<div class="trend-strip">${points.map(({ exam, pct }) => {
    const height = pct == null ? 5 : Math.max(8, Math.round((1 - Math.min(pct, max) / (max + 4)) * 58));
    return `<div class="trend-point"><div class="trend-bar-wrap"><div class="trend-bar" style="height:${height}px;opacity:${pct == null ? .18 : .82}"></div></div><strong>${pct == null ? "—" : `${pct}%`}</strong><span>${esc(exam.name)}</span></div>`;
  }).join("")}</div>`;
}

function subjectCards(exam) {
  if (!exam) return "";
  return SUBJECTS.map(([key, label]) => {
    const subject = exam.subjects?.[key] || {};
    const school = rankByScope(subject.rankings, "school");
    const clazz = rankByScope(subject.rankings, "class");
    const score = scoreOf(subject);
    const converted = subject.scoreMode === "converted" || subject.scoreMode === "raw_and_converted";
    return `<div class="subject-card"><div class="eyebrow">${label}${converted ? " · 赋分" : ""}</div><div class="score">${score ?? "—"}</div><div class="meta">${school ? `校 ${school.rank}/${school.participants}` : "校排名 —"}<br>${clazz ? `班 ${clazz.rank}/${clazz.participants}` : "班排名 —"}</div></div>`;
  }).join("");
}

function renderHeader() {
  const students = state.me?.students || [];
  const selector = students.length > 1 ? `<select id="student-select" aria-label="切换孩子">${students.map((s) => `<option value="${esc(s.id)}" ${state.student?.id === s.id ? "selected" : ""}>${esc(s.displayName)}</option>`).join("")}</select>` : "";
  return `<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">迹</div><span>高三轨迹</span></div><div class="top-actions">${selector}<button class="btn btn-outline btn-small hide-mobile" data-action="export">导出 JSON</button><button class="btn btn-outline btn-small" data-action="logout">退出</button></div></div></header>`;
}

function renderOverview() {
  const exam = latestExam();
  if (!exam) {
    return `<div class="card card-pad empty"><h2>还没有考试记录</h2><p>先记录一次月考、联考或模拟考试。缺失字段可以以后再补。</p><button class="btn btn-primary" data-action="new-exam">记录第一次考试</button></div>`;
  }
  const school = rankByScope(exam.overall?.rankings, "school");
  const clazz = rankByScope(exam.overall?.rankings, "class");
  return `<div class="hero"><section class="card card-pad"><div class="title-row"><div><div class="eyebrow">最近一次 · ${fmtDate(exam.date)}</div><h1>${esc(exam.name)}</h1><div class="muted">${esc(state.student.displayName)} · ${esc(state.student.grade || "高三")} · ${esc(state.student.subjectTrack || "")}</div></div><button class="btn btn-outline btn-small" data-action="edit-exam" data-id="${esc(exam.id)}">编辑</button></div><div class="latest-score"><strong>${overallScore(exam) ?? "—"}</strong><span>总分</span></div><div class="rank-grid">${rankCard("学校位置", school)}${rankCard("班级位置", clazz)}</div></section><section class="card card-pad"><div class="eyebrow">学校相对位置</div><h2>最近 6 次</h2>${trendHtml()}</section></div><section class="card card-pad"><div class="section-head"><h2>六科状态</h2><span class="muted">分数只是结果，排名用于观察相对位置</span></div><div class="subject-grid">${subjectCards(exam)}</div></section>`;
}

function renderExamList() {
  return `<section><div class="section-head"><h2>历次考试</h2><button class="btn btn-primary" data-action="new-exam">＋ 记录考试</button></div>${state.exams.length ? `<div class="exam-list">${state.exams.map((exam) => {
    const school = rankByScope(exam.overall?.rankings, "school");
    const clazz = rankByScope(exam.overall?.rankings, "class");
    return `<article class="card exam-row"><div><div class="name">${esc(exam.name)}</div><small>${fmtDate(exam.date)} · ${esc(exam.type)}${exam.dataStatus === "partial" ? " · 数据待补" : ""}</small></div><div class="metric"><small>总分</small><strong>${overallScore(exam) ?? "—"}</strong></div><div class="metric"><small>校排名</small><strong>${school ? `${school.rank}/${school.participants}` : "—"}</strong></div><div class="metric"><small>班排名</small><strong>${clazz ? `${clazz.rank}/${clazz.participants}` : "—"}</strong></div><button class="btn btn-outline btn-small" data-action="edit-exam" data-id="${esc(exam.id)}">查看/编辑</button></article>`;
  }).join("")}</div>` : `<div class="card empty">暂无考试记录。</div>`}</section>`;
}

function shareFieldsControls(prefix, defaults = {}) {
  const fields = [
    ["displayName", "昵称"], ["graduationYear", "毕业年份"], ["school", "学校"], ["className", "班级"],
    ["overallScore", "总分"], ["overallRank", "总排名"], ["subjectScores", "单科成绩"], ["subjectRanks", "单科排名"], ["history", "历史考试"]
  ];
  return `<div class="check-grid">${fields.map(([key, label]) => `<label class="check"><input type="checkbox" name="${prefix}-${key}" ${defaults[key] !== false ? "checked" : ""}>${label}</label>`).join("")}</div>`;
}

function renderSharing() {
  return `<section><div class="section-head"><div><h2>分享与隐私</h2><div class="muted">默认仅家庭成员可见。分享输出由服务端白名单生成，备注不会对外返回。</div></div></div>${state.notice ? `<div class="notice-box">${esc(state.notice)}</div>` : ""}<div class="share-grid"><article class="card share-card"><h3>私密分享链接</h3><p class="muted">拿到随机链接的人可以查看。链接可以撤销，也可以设为固定快照。</p><div class="field"><label>分享模式</label><select id="secret-mode"><option value="live">实时：以后新增成绩也可见</option><option value="snapshot">快照：只保留创建时的数据</option></select></div><div class="field"><label>有效期（可不填）</label><input id="secret-expiry" type="date"></div>${shareFieldsControls("secret", { school: false, className: false })}<button class="btn btn-primary" data-action="create-secret">生成私密链接</button></article><article class="card share-card"><h3>公开主页</h3><p class="muted">无需登录即可访问，但默认 noindex，不创建学生搜索或排行榜。</p><div class="field"><label>公开地址</label><div style="display:flex;gap:8px;align-items:center"><span class="muted">/p/</span><input id="public-slug" placeholder="例如 xiaowang-2027"></div></div><div class="field"><label>分享模式</label><select id="public-mode"><option value="live">实时主页</option><option value="snapshot">固定快照</option></select></div>${shareFieldsControls("public", { school: false, className: false })}<button class="btn btn-primary" data-action="create-public">创建公开主页</button></article></div><div class="section-head"><h2>当前分享</h2></div><div class="card card-pad">${state.shares.length ? state.shares.map((item) => `<div class="share-item"><div><strong>${item.kind === "secret" ? "私密链接" : "公开主页"}</strong> <span class="badge">${item.mode === "snapshot" ? "快照" : "实时"}</span>${item.expiresAt ? ` <span class="badge badge-warn">到期 ${esc(item.expiresAt.slice(0,10))}</span>` : ""}<div class="muted" style="margin-top:5px">创建于 ${esc(item.createdAt.slice(0,10))}${item.kind === "secret" ? " · 出于安全原因，旧私密 token 不回显；需要重新分享时可撤销后再生成。" : ` · /p/${esc(item.locator)}`}</div></div><button class="btn btn-danger btn-small" data-action="revoke-share" data-kind="${item.kind}" data-locator="${esc(item.locator)}">撤销</button></div>`).join("") : `<div class="empty">当前没有任何外部分享，孩子成绩仅家庭内可见。</div>`}</div></section>`;
}

function renderSettings() {
  const s = state.student;
  return `<section><div class="section-head"><h2>孩子资料与安全</h2></div><div class="settings-grid"><form id="profile-form" class="card card-pad"><h3>孩子资料</h3><div class="field"><label>显示昵称</label><input name="displayName" value="${esc(s.displayName || "")}"></div><div class="field"><label>毕业年份</label><input name="graduationYear" inputmode="numeric" value="${esc(s.graduationYear || "")}"></div><div class="field"><label>学校（默认不对外分享）</label><input name="schoolLabel" value="${esc(s.schoolLabel || "")}"></div><div class="field"><label>当前班级</label><input name="className" value="${esc(s.className || "")}"></div><div class="field"><label>选科</label><input name="subjectTrack" value="${esc(s.subjectTrack || "物化生")}"></div><button class="btn btn-primary" type="submit">保存资料</button></form><div class="card card-pad"><h3>账号安全</h3><p class="muted">修改密码会使其他设备上的旧会话全部失效。</p><button class="btn btn-outline" data-action="change-password">修改密码</button><button class="btn btn-danger" style="margin-left:8px" data-action="logout-all">退出所有设备</button><hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><h3>数据所有权</h3><p class="muted">可以随时导出完整 JSON，不把数据锁在本工具里。</p><button class="btn btn-outline" data-action="export">导出完整数据</button></div></div></section>`;
}

function renderDashboard() {
  const body = state.tab === "overview" ? renderOverview() : state.tab === "exams" ? renderExamList() : state.tab === "sharing" ? renderSharing() : renderSettings();
  app.innerHTML = `${renderHeader()}<main class="container"><div class="title-row"><div><div class="eyebrow">家庭轨迹</div><h1 style="margin:4px 0 0">${esc(state.student?.displayName || "孩子")}</h1></div></div><nav class="tabs" aria-label="主导航"><button class="tab ${state.tab === "overview" ? "active" : ""}" data-tab="overview">轨迹</button><button class="tab ${state.tab === "exams" ? "active" : ""}" data-tab="exams">考试</button><button class="tab ${state.tab === "sharing" ? "active" : ""}" data-tab="sharing">分享与隐私</button><button class="tab ${state.tab === "settings" ? "active" : ""}" data-tab="settings">设置</button></nav>${body}</main><footer class="footer">高三轨迹 · 数据默认私有 · ${esc(state.me?.appVersion || "")}</footer>`;
  bindDashboard();
}

function renderLogin(error = "") {
  app.innerHTML = `<main class="login-shell"><section class="login-card"><div class="brand-mark">迹</div><h1>高三轨迹</h1><p>记录重要考试，观察孩子在学校里的相对位置变化。成绩默认仅家庭内部可见。</p>${error ? `<div class="error-box">${esc(error)}</div>` : ""}<form id="login-form"><div class="field"><label>家庭账号</label><input name="username" autocomplete="username" required></div><div class="field"><label>密码</label><input name="password" type="password" autocomplete="current-password" minlength="10" required></div><button class="btn btn-primary btn-block" type="submit">登录</button></form></section></main>`;
  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/api/login", { method: "POST", body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      state.csrf = result.csrf;
      await loadPrivateApp();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

function rankInputs(prefix, ranking) {
  return `<input name="${prefix}-rank" inputmode="numeric" placeholder="排名" value="${ranking?.rank ?? ""}"><input name="${prefix}-participants" inputmode="numeric" placeholder="人数" value="${ranking?.participants ?? ""}">`;
}

function examDialog(exam = null) {
  state.editingExam = exam;
  const overallSchool = rankByScope(exam?.overall?.rankings, "school");
  const overallClass = rankByScope(exam?.overall?.rankings, "class");
  const rows = SUBJECTS.map(([key, label, full]) => {
    const s = exam?.subjects?.[key] || {};
    const school = rankByScope(s.rankings, "school");
    const clazz = rankByScope(s.rankings, "class");
    const defaultMode = ["chemistry", "biology"].includes(key) ? "raw_and_converted" : "raw";
    return `<div><strong>${label}</strong></div><div><select name="${key}-mode"><option value="raw" ${(s.scoreMode || defaultMode) === "raw" ? "selected" : ""}>原始分</option><option value="raw_and_converted" ${(s.scoreMode || defaultMode) === "raw_and_converted" ? "selected" : ""}>原始+赋分</option></select></div><div><input name="${key}-full" inputmode="decimal" value="${s.fullScore ?? full}" aria-label="${label}满分"></div><div><input name="${key}-raw" inputmode="decimal" value="${s.rawScore ?? ""}" aria-label="${label}原始分"></div><div><input name="${key}-final" inputmode="decimal" value="${s.finalScore ?? ""}" aria-label="${label}最终分"></div><div>${rankInputs(`${key}-class`, clazz)}</div><div>${rankInputs(`${key}-school`, school)}</div>`;
  }).join("");
  document.body.insertAdjacentHTML("beforeend", `<div class="dialog-backdrop" id="exam-dialog"><form class="dialog" id="exam-form"><div class="dialog-head"><h2>${exam ? "编辑考试" : "记录一次考试"}</h2><button type="button" class="btn btn-outline btn-small" data-close-dialog>关闭</button></div><div class="form-grid"><div class="field"><label>考试名称</label><input name="name" required value="${esc(exam?.name || "")}" placeholder="例如 9月联考"></div><div class="field"><label>考试日期</label><input name="date" type="date" required value="${esc(exam?.date || new Date().toISOString().slice(0,10))}"></div><div class="field"><label>考试类型</label><select name="type">${[["weekly","周测"],["monthly","月考"],["midterm","期中"],["final","期末"],["joint","联考"],["mock1","一模"],["mock2","二模"],["mock3","三模"],["other","其他"]].map(([v,l]) => `<option value="${v}" ${exam?.type === v ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="field"><label>数据状态</label><select name="dataStatus"><option value="partial" ${exam?.dataStatus !== "complete" ? "selected" : ""}>待补充</option><option value="complete" ${exam?.dataStatus === "complete" ? "selected" : ""}>完整</option></select></div><div class="field"><label>学校公布总分</label><input name="officialScore" inputmode="decimal" value="${exam?.overall?.officialScore ?? ""}"></div><div class="field"><label>校排名</label><input name="overall-school-rank" inputmode="numeric" value="${overallSchool?.rank ?? ""}"></div><div class="field"><label>校排名人数</label><input name="overall-school-participants" inputmode="numeric" value="${overallSchool?.participants ?? ""}"></div><div class="field"><label>班排名</label><input name="overall-class-rank" inputmode="numeric" value="${overallClass?.rank ?? ""}"></div><div class="field"><label>班级人数</label><input name="overall-class-participants" inputmode="numeric" value="${overallClass?.participants ?? ""}"></div><div class="field"><label>考试状态</label><select name="status"><option value="normal">正常</option><option value="good" ${exam?.status === "good" ? "selected" : ""}>发挥较好</option><option value="poor" ${exam?.status === "poor" ? "selected" : ""}>发挥失常</option><option value="absent" ${exam?.status === "absent" ? "selected" : ""}>缺考</option><option value="partial" ${exam?.status === "partial" ? "selected" : ""}>数据不完整</option></select></div></div><div class="subject-editor"><h3>六科成绩与排名</h3><div class="score-editor-grid"><div class="header">科目</div><div class="header">计分方式</div><div class="header">满分</div><div class="header">原始分</div><div class="header">最终/赋分</div><div class="header">班排 / 人数</div><div class="header">校排 / 人数</div>${rows}</div></div><div class="field" style="margin-top:16px"><label>备注（永不通过分享接口返回）</label><textarea name="notes" placeholder="例如：数学圆锥曲线失分较多">${esc(exam?.notes || "")}</textarea></div><div id="exam-form-error"></div><div class="dialog-actions">${exam ? `<button type="button" class="btn btn-danger" data-action="delete-exam">删除</button>` : ""}<button type="button" class="btn btn-outline" data-close-dialog>取消</button><button class="btn btn-primary" type="submit">保存考试</button></div></form></div>`);
  document.querySelectorAll("[data-close-dialog]").forEach((el) => el.addEventListener("click", closeDialog));
  document.querySelector("#exam-form").addEventListener("submit", saveExam);
  document.querySelector("[data-action='delete-exam']")?.addEventListener("click", deleteExam);
}

function closeDialog() {
  document.querySelector("#exam-dialog")?.remove();
  state.editingExam = null;
}

function value(form, name) {
  const v = form.get(name);
  return v === "" || v == null ? null : v;
}

function intOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rankingFromForm(form, prefix, scope, label) {
  const rank = intOrNull(value(form, `${prefix}-rank`));
  const participants = intOrNull(value(form, `${prefix}-participants`));
  if (rank == null && participants == null) return null;
  return { scope, label, rank, participants, basis: "final_score" };
}

async function saveExam(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const subjects = {};
  for (const [key] of SUBJECTS) {
    subjects[key] = {
      scoreMode: value(form, `${key}-mode`) || "raw",
      fullScore: numOrNull(value(form, `${key}-full`)),
      rawScore: numOrNull(value(form, `${key}-raw`)),
      finalScore: numOrNull(value(form, `${key}-final`)),
      rankings: [rankingFromForm(form, `${key}-class`, "class", state.student.className || "班级"), rankingFromForm(form, `${key}-school`, "school", "学校")].filter(Boolean)
    };
  }
  const payload = {
    name: value(form, "name"), date: value(form, "date"), type: value(form, "type"), status: value(form, "status"), dataStatus: value(form, "dataStatus"),
    overall: { officialScore: numOrNull(value(form, "officialScore")), rankings: [rankingFromForm(form, "overall-class", "class", state.student.className || "班级"), rankingFromForm(form, "overall-school", "school", "学校")].filter(Boolean) },
    subjects, notes: value(form, "notes"), expectedRevision: state.editingExam?.revision
  };
  try {
    if (state.editingExam) await api(`/api/students/${state.student.id}/exams/${state.editingExam.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api(`/api/students/${state.student.id}/exams`, { method: "POST", body: JSON.stringify(payload) });
    closeDialog();
    await loadStudentData();
    state.tab = "exams";
    renderDashboard();
  } catch (err) {
    document.querySelector("#exam-form-error").innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

async function deleteExam() {
  if (!state.editingExam || !confirm(`确认删除“${state.editingExam.name}”？历史版本仍会保留在服务端。`)) return;
  try {
    await api(`/api/students/${state.student.id}/exams/${state.editingExam.id}`, { method: "DELETE", body: JSON.stringify({ expectedRevision: state.editingExam.revision }) });
    closeDialog();
    await loadStudentData();
    renderDashboard();
  } catch (err) {
    alert(err.message);
  }
}

function selectedShareFields(prefix) {
  const result = {};
  for (const key of ["displayName","graduationYear","school","className","overallScore","overallRank","subjectScores","subjectRanks","history"]) {
    result[key] = Boolean(document.querySelector(`[name='${prefix}-${key}']`)?.checked);
  }
  return result;
}

async function createShare(kind) {
  const prefix = kind === "public" ? "public" : "secret";
  const body = {
    kind,
    mode: document.querySelector(`#${prefix}-mode`).value,
    fields: selectedShareFields(prefix)
  };
  if (kind === "secret") {
    const expiry = document.querySelector("#secret-expiry").value;
    if (expiry) body.expiresAt = `${expiry}T23:59:59.999Z`;
  } else {
    body.slug = document.querySelector("#public-slug").value.trim();
  }
  try {
    const result = await api(`/api/students/${state.student.id}/shares`, { method: "POST", body: JSON.stringify(body) });
    await loadShares();
    if (kind === "secret" && result.token) {
      const url = `${location.origin}/share/${result.token}`;
      state.notice = `私密链接已生成（原始 token 只显示这一次）：${url}`;
      try { await navigator.clipboard.writeText(url); state.notice += "；已复制到剪贴板。"; } catch {}
    } else {
      const url = `${location.origin}/p/${result.share.locator}`;
      state.notice = `公开主页已创建：${url}`;
    }
    renderDashboard();
  } catch (err) {
    state.notice = `创建失败：${err.message}`;
    renderDashboard();
  }
}

async function revokeShare(kind, locator) {
  if (!confirm("撤销后该外部地址会失效。继续吗？")) return;
  await api(`/api/students/${state.student.id}/shares/revoke`, { method: "POST", body: JSON.stringify({ kind, locator }) });
  state.notice = "分享已撤销。";
  await loadShares();
  renderDashboard();
}

async function exportData() {
  const data = await api(`/api/students/${state.student.id}/export`);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `score-${state.student.displayName}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function changePasswordDialog() {
  const current = prompt("请输入当前密码");
  if (!current) return;
  const next = prompt("请输入新密码（至少10个字符）");
  if (!next) return;
  try {
    const result = await api("/api/me/password", { method: "POST", body: JSON.stringify({ currentPassword: current, newPassword: next }) });
    state.csrf = result.csrf;
    alert("密码已修改，其他设备旧会话已失效。");
  } catch (err) { alert(err.message); }
}

function bindDashboard() {
  document.querySelectorAll("[data-tab]").forEach((el) => el.addEventListener("click", async () => {
    state.tab = el.dataset.tab;
    if (state.tab === "sharing") await loadShares();
    renderDashboard();
  }));
  document.querySelector("#student-select")?.addEventListener("change", async (event) => {
    state.student = state.me.students.find((s) => s.id === event.target.value);
    await loadStudentData();
    renderDashboard();
  });
  document.querySelectorAll("[data-action='new-exam']").forEach((el) => el.addEventListener("click", () => examDialog()));
  document.querySelectorAll("[data-action='edit-exam']").forEach((el) => el.addEventListener("click", () => examDialog(state.exams.find((x) => x.id === el.dataset.id))));
  document.querySelectorAll("[data-action='export']").forEach((el) => el.addEventListener("click", exportData));
  document.querySelectorAll("[data-action='logout']").forEach((el) => el.addEventListener("click", async () => { await api("/api/logout", { method: "POST" }).catch(() => {}); location.assign("/"); }));
  document.querySelector("[data-action='create-secret']")?.addEventListener("click", () => createShare("secret"));
  document.querySelector("[data-action='create-public']")?.addEventListener("click", () => createShare("public"));
  document.querySelectorAll("[data-action='revoke-share']").forEach((el) => el.addEventListener("click", () => revokeShare(el.dataset.kind, el.dataset.locator)));
  document.querySelector("[data-action='change-password']")?.addEventListener("click", changePasswordDialog);
  document.querySelector("[data-action='logout-all']")?.addEventListener("click", async () => {
    if (!confirm("确认让所有设备退出登录？")) return;
    await api("/api/me/logout-all", { method: "POST", body: "{}" });
    location.assign("/");
  });
  document.querySelector("#profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api(`/api/students/${state.student.id}/profile`, { method: "PATCH", body: JSON.stringify(Object.fromEntries(form.entries())) });
      state.student = result.student;
      state.me.students = state.me.students.map((s) => s.id === result.student.id ? result.student : s);
      renderDashboard();
    } catch (err) { alert(err.message); }
  });
}

async function loadStudentData() {
  if (!state.student) return;
  const result = await api(`/api/students/${state.student.id}/exams`);
  state.exams = result.exams || [];
}

async function loadShares() {
  if (!state.student) return;
  const result = await api(`/api/students/${state.student.id}/shares`);
  state.shares = result.shares || [];
}

async function loadPrivateApp() {
  try {
    state.me = await api("/api/me");
    state.csrf = state.me.csrf;
    state.student = state.me.students?.[0] || null;
    if (!state.student) throw new Error("当前家庭还没有孩子资料");
    await loadStudentData();
    renderDashboard();
  } catch (err) {
    if (err.status === 401) renderLogin();
    else renderLogin(err.message);
  }
}

function publicSubjectCards(exam) {
  if (!exam?.subjects) return "";
  return SUBJECTS.map(([key, label]) => {
    const subject = exam.subjects[key] || {};
    const score = subject.finalScore ?? subject.rawScore ?? null;
    const school = rankByScope(subject.rankings, "school");
    return `<div class="subject-card"><div class="eyebrow">${label}</div><div class="score">${score ?? "—"}</div><div class="meta">${school ? `校 ${school.rank}/${school.participants}` : "排名未分享"}</div></div>`;
  }).join("");
}

async function renderExternal(kind, locator) {
  try {
    const result = await api(`/api/share/${kind}/${encodeURIComponent(locator)}`);
    const data = result.data;
    const latest = data.exams?.[0] || null;
    const overallSchool = rankByScope(latest?.overallRankings, "school");
    app.innerHTML = `<main class="public-shell"><div class="brand"><div class="brand-mark">迹</div><span>高三轨迹 · 分享页</span></div><div class="privacy-note">此页面由家庭主动分享 · 不参与搜索索引 · 请勿未经允许转发</div><section class="card card-pad"><div class="eyebrow">${result.share.mode === "snapshot" ? "固定快照" : "实时分享"}</div><h1>${esc(data.student?.displayName || "学生轨迹")}</h1><div class="muted">${data.student?.graduationYear ? `${esc(data.student.graduationYear)}届` : ""}${data.student?.schoolLabel ? ` · ${esc(data.student.schoolLabel)}` : ""}${data.student?.className ? ` · ${esc(data.student.className)}` : ""}</div>${latest ? `<div class="latest-score"><strong>${latest.overallScore ?? "—"}</strong><span>${esc(latest.name)} · ${fmtDate(latest.date)}</span></div><div class="rank-grid">${rankCard("学校位置", overallSchool)}${emptyRank("更多信息")}</div><div class="subject-grid">${publicSubjectCards(latest)}</div>` : `<div class="empty">暂未分享考试数据。</div>`}</section>${data.exams?.length > 1 ? `<div class="section-head"><h2>历史考试</h2></div><div class="exam-list">${data.exams.map((exam) => `<article class="card exam-row"><div><div class="name">${esc(exam.name)}</div><small>${fmtDate(exam.date)}</small></div><div class="metric"><small>总分</small><strong>${exam.overallScore ?? "—"}</strong></div><div></div><div></div></article>`).join("")}</div>` : ""}</main><footer class="footer">分享链接可由家庭随时撤销</footer>`;
  } catch (err) {
    app.innerHTML = `<main class="login-shell"><section class="login-card"><div class="brand-mark">迹</div><h1>分享已失效</h1><p>${esc(err.message)}</p></section></main>`;
  }
}

async function bootstrap() {
  const path = location.pathname;
  if (path.startsWith("/share/")) return renderExternal("secret", path.slice("/share/".length));
  if (path.startsWith("/p/")) return renderExternal("public", path.slice("/p/".length));
  return loadPrivateApp();
}

bootstrap();
