const V4_SUBJECTS = [
  ["chinese", "语文"],
  ["math", "数学"],
  ["english", "英语"],
  ["physics", "物理"],
  ["chemistry", "化学"],
  ["biology", "生物"]
];

const V4_CATEGORY_LABELS = {
  weekly: "周测",
  monthly: "月考",
  midterm: "期中",
  final: "期末",
  joint_school: "联考 / 校考",
  mock: "模考",
  other: "其他"
};

let v4Me = null;
let v4ScanRunning = false;
const v4NativeFetch = window.fetch.bind(window);

function v4Esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function v4Category(type) {
  if (type === "joint" || type === "school") return "joint_school";
  if (["mock1", "mock2", "mock3"].includes(type)) return "mock";
  return V4_CATEGORY_LABELS[type] ? type : "other";
}

function v4Rank(rankings, scope) {
  return (rankings || []).find((item) => item?.scope === scope && item?.rank != null) || null;
}

function v4Pct(ranking) {
  const rank = ranking?.rank;
  const total = ranking?.participants;
  if (!Number.isInteger(rank) || !Number.isInteger(total) || rank < 1 || total < rank) return null;
  return Math.round((rank / total) * 1000) / 10;
}

function v4Fmt(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toFixed(1).replace(/\.0$/, "");
}

function v4Score(subject) {
  return subject?.finalScore ?? subject?.rawScore ?? null;
}

function v4OverallScore(exam) {
  return exam?.overall?.officialScore ?? exam?.overall?.calculatedScore ?? null;
}

function v4OverallRank(exam, scope) {
  return v4Rank(exam?.overall?.rankings || exam?.overallRankings, scope);
}

function v4SubjectRank(exam, key, scope) {
  return v4Rank(exam?.subjects?.[key]?.rankings, scope);
}

function v4Position(ranking, prefix = "") {
  if (!ranking?.rank) return "—";
  const pct = v4Pct(ranking);
  if (pct != null) return `${prefix}前 ${v4Fmt(pct)}%`;
  return `${prefix}第 ${ranking.rank} 名`;
}

function v4RankDetail(ranking) {
  if (!ranking?.rank) return "尚无排名";
  return ranking.participants ? `第 ${ranking.rank} 名 / ${ranking.participants} 人` : `第 ${ranking.rank} 名 · 总人数未填`;
}

function v4Comparable(exams) {
  const list = Array.isArray(exams) ? exams : [];
  const latest = list[0];
  if (!latest) return { exams: [], category: "none", label: "暂无考试", note: "还没有考试记录。" };
  const category = latest.comparison?._category || v4Category(latest.type);
  const sameCategory = list.filter((exam) => (exam.comparison?._category || v4Category(exam.type)) === category);
  const storedSeries = latest.comparison?._storedSeries || null;
  if (storedSeries) {
    const sameSeries = sameCategory.filter((exam) => (exam.comparison?._storedSeries || null) === storedSeries);
    if (sameSeries.length >= 2) {
      return {
        exams: sameSeries.slice(0, 6),
        category,
        label: `${V4_CATEGORY_LABELS[category] || "同类考试"} · ${storedSeries}`,
        note: "趋势只使用同类别、同系列考试。"
      };
    }
  }
  return {
    exams: sameCategory.slice(0, 6),
    category,
    label: V4_CATEGORY_LABELS[category] || "同类考试",
    note: sameCategory.length >= 2 ? "趋势只使用同一考试类别；其他考试仍保留在历史中。" : "还没有第二次同类别考试，暂不形成趋势结论。"
  };
}

function v4Metric(latest, previous, key = null) {
  if (!latest || !previous) return null;
  const schoolNow = key ? v4SubjectRank(latest, key, "school") : v4OverallRank(latest, "school");
  const schoolPrev = key ? v4SubjectRank(previous, key, "school") : v4OverallRank(previous, "school");
  const pctNow = v4Pct(schoolNow);
  const pctPrev = v4Pct(schoolPrev);
  if (pctNow != null && pctPrev != null) {
    return { kind: "percentile", delta: pctPrev - pctNow, detail: `前 ${v4Fmt(pctPrev)}% → 前 ${v4Fmt(pctNow)}%` };
  }
  if (schoolNow?.rank != null && schoolPrev?.rank != null) {
    return { kind: "school-rank", delta: schoolPrev.rank - schoolNow.rank, detail: `校第 ${schoolPrev.rank} → 第 ${schoolNow.rank}` };
  }
  const classNow = key ? v4SubjectRank(latest, key, "class") : v4OverallRank(latest, "class");
  const classPrev = key ? v4SubjectRank(previous, key, "class") : v4OverallRank(previous, "class");
  if (classNow?.rank != null && classPrev?.rank != null) {
    return { kind: "class-rank", delta: classPrev.rank - classNow.rank, detail: `班第 ${classPrev.rank} → 第 ${classNow.rank}` };
  }
  if (key) {
    const scoreNow = v4Score(latest?.subjects?.[key]);
    const scorePrev = v4Score(previous?.subjects?.[key]);
    if (scoreNow != null && scorePrev != null) {
      return { kind: "score", delta: scoreNow - scorePrev, detail: `${scorePrev} → ${scoreNow} 分` };
    }
  }
  return null;
}

function v4Direction(metric) {
  if (!metric) return { label: "等待可比考试", tone: "neutral" };
  const threshold = metric.kind === "percentile" ? 0.4 : metric.kind === "score" ? 1 : 0;
  if (metric.delta > threshold) return { label: metric.kind === "score" ? "分数上升" : "位置向前", tone: "up" };
  if (metric.delta < -threshold) return { label: metric.kind === "score" ? "分数下降" : "值得留意", tone: "down" };
  return { label: "基本稳定", tone: "neutral" };
}

function v4Sources(latest, previous) {
  const rows = V4_SUBJECTS.map(([key, label]) => {
    const metric = v4Metric(latest, previous, key);
    const direction = v4Direction(metric);
    return { key, label, metric, direction };
  }).filter((item) => item.metric);
  const relative = rows.filter((item) => item.metric.kind !== "score");
  const source = relative.length ? relative : rows;
  return source
    .sort((a, b) => Math.abs(b.metric.delta) - Math.abs(a.metric.delta))
    .slice(0, 3);
}

async function v4Api(path) {
  const response = await v4NativeFetch(path, { credentials: "same-origin", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `请求失败 (${response.status})`);
  return payload;
}

async function v4Context() {
  v4Me = v4Me || await v4Api("/api/me");
  const selectedId = document.querySelector("#student-select")?.value || v4Me.students?.[0]?.id;
  const student = v4Me.students?.find((item) => item.id === selectedId) || v4Me.students?.[0] || null;
  return { me: v4Me, student };
}

async function v4Exams(studentId) {
  const result = await v4Api(`/api/students/${encodeURIComponent(studentId)}/exams`);
  return result.exams || [];
}

function v4OverviewNode(exams, student) {
  const latest = exams[0];
  if (!latest) return null;
  const school = v4OverallRank(latest, "school");
  const clazz = v4OverallRank(latest, "class");
  const comparable = v4Comparable(exams);
  const previous = comparable.exams[1] || null;
  const overallMetric = previous ? v4Metric(comparable.exams[0], previous) : null;
  const direction = v4Direction(overallMetric);
  const sources = previous ? v4Sources(comparable.exams[0], previous) : [];
  const position = school?.rank ? v4Position(school, "校") : clazz?.rank ? v4Position(clazz, "班") : "位置待补";
  const score = v4OverallScore(latest);
  const node = document.createElement("section");
  node.className = "v4-overview";
  node.dataset.v4Overview = "1";
  node.innerHTML = `<div class="v4-overview-grid">
    <article class="card v4-focus-card">
      <div class="v4-kicker">现在在哪</div>
      <strong class="v4-position">${v4Esc(position)}</strong>
      <div class="v4-position-meta">${v4Esc(v4RankDetail(school?.rank ? school : clazz))}</div>
      <div class="v4-exam-context"><span>${v4Esc(latest.name || "最近一次考试")}</span><span>${v4Esc(latest.date || "")}</span>${score != null ? `<span>${v4Esc(score)} 分</span>` : ""}</div>
    </article>
    <article class="card v4-change-card">
      <div class="v4-kicker">最近变化</div>
      <strong class="v4-change is-${direction.tone}">${v4Esc(direction.label)}</strong>
      <p>${v4Esc(overallMetric?.detail || comparable.note)}</p>
      <small>${v4Esc(comparable.label)} · ${v4Esc(comparable.note)}</small>
    </article>
    <article class="card v4-source-card">
      <div class="v4-kicker">变化来自哪里</div>
      ${sources.length ? `<div class="v4-source-list">${sources.map((item) => `<button type="button" class="v4-source-row" data-v4-open-subject="${item.key}"><strong>${item.label}</strong><span class="v4-change is-${item.direction.tone}">${v4Esc(item.direction.label)}</span><small>${v4Esc(item.metric.detail)}</small></button>`).join("")}</div>` : `<p class="v4-empty-copy">有第二次同类别考试后，这里会直接指出主要变化科目。</p>`}
      <button type="button" class="btn btn-outline btn-small v4-deep-link" data-v4-open-deep>深入看轨迹</button>
    </article>
  </div>
  <div class="v4-overview-foot"><span>${v4Esc(student?.displayName || "孩子")} · ${v4Esc(student?.subjectTrack || "")}</span><button type="button" class="btn btn-outline btn-small" data-action="edit-exam" data-id="${v4Esc(latest.id)}">查看最近考试</button></div>`;
  return node;
}

function v4HideLegacyOverview(main) {
  const hero = main.querySelector(":scope > .hero");
  if (hero) hero.classList.add("v4-legacy-hidden");
  const maybeSubjects = hero?.nextElementSibling;
  if (maybeSubjects?.classList.contains("card") && maybeSubjects.querySelector(".subject-grid")) {
    maybeSubjects.classList.add("v4-legacy-hidden");
  }
}

function v4BindOverview(node) {
  node.querySelector("[data-v4-open-deep]")?.addEventListener("click", () => {
    const details = document.querySelector("[data-v4-deep-dive]");
    if (!details) return;
    details.open = true;
    details.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  node.querySelectorAll("[data-v4-open-subject]").forEach((button) => button.addEventListener("click", () => {
    try { localStorage.setItem("score:v030:subject", button.dataset.v4OpenSubject); } catch {}
    const details = document.querySelector("[data-v4-deep-dive]");
    if (details) {
      details.open = true;
      details.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    const subjectButton = document.querySelector(`[data-v3-subject='${button.dataset.v4OpenSubject}']`);
    subjectButton?.click();
  }));
}

function v4ConsolidateDeepDive(main) {
  const trajectory = main.querySelector("[data-v3-private-trajectory]");
  if (!trajectory || trajectory.closest("[data-v4-deep-dive]")) return Boolean(trajectory);
  trajectory.querySelector("[data-v3-overall]")?.classList.add("v4-duplicate-summary");
  const details = document.createElement("details");
  details.className = "v4-deep-dive";
  details.dataset.v4DeepDive = "1";
  details.innerHTML = `<summary><span><strong>深入看轨迹</strong><small>单科历史、六科变化和不同阅读视角</small></span><span aria-hidden="true">＋</span></summary>`;
  trajectory.before(details);
  details.append(trajectory);
  return true;
}

function v4WatchDeepDive(main) {
  if (v4ConsolidateDeepDive(main) || main.dataset.v4DeepWatch === "1") return;
  main.dataset.v4DeepWatch = "1";
  const observer = new MutationObserver(() => {
    if (v4ConsolidateDeepDive(main)) observer.disconnect();
  });
  observer.observe(main, { childList: true });
  setTimeout(() => observer.disconnect(), 2500);
}

async function v4EnhanceOverview(main) {
  if (main.querySelector("[data-v4-overview]")) {
    v4HideLegacyOverview(main);
    v4WatchDeepDive(main);
    return;
  }
  try {
    const { student } = await v4Context();
    if (!student || !main.isConnected) return;
    const exams = await v4Exams(student.id);
    if (!main.isConnected || !exams.length || main.querySelector("[data-v4-overview]")) return;
    const node = v4OverviewNode(exams, student);
    const hero = main.querySelector(":scope > .hero");
    if (node && hero) {
      hero.before(node);
      v4BindOverview(node);
      v4HideLegacyOverview(main);
      v4WatchDeepDive(main);
    }
  } catch {}
}

function v4SetShareAudience(prefix, audience, card) {
  const defaults = audience === "teacher"
    ? { displayName: true, graduationYear: true, school: false, className: false, overallScore: true, overallRank: true, subjectScores: true, subjectRanks: true }
    : { displayName: true, graduationYear: false, school: false, className: false, overallScore: true, overallRank: true, subjectScores: true, subjectRanks: true };
  for (const [key, checked] of Object.entries(defaults)) {
    const input = card.querySelector(`[name='${prefix}-${key}']`);
    if (input) input.checked = checked;
  }
  card.dataset.v4Audience = audience;
  card.querySelectorAll("[data-v4-audience]").forEach((button) => button.classList.toggle("is-active", button.dataset.v4Audience === audience));
  const scope = card.querySelector(`input[name='${prefix}-scope-v2']:checked`)?.value || "single";
  const summary = card.querySelector("[data-v4-privacy-summary]");
  if (summary) {
    summary.innerHTML = audience === "teacher"
      ? `<strong>老师查看</strong><span>分享${scope === "trajectory" ? "总体、单科与历次轨迹" : "这一次考试"}；默认隐藏学校、班级、家庭备注和账号信息。</span>`
      : audience === "custom"
        ? `<strong>自定义</strong><span>按下方“修改分享内容”中的勾选项生成；家庭备注和账号信息始终不会输出。</span>`
        : `<strong>家人查看</strong><span>分享${scope === "trajectory" ? "成绩、排名和历次变化" : "这一次成绩与排名"}；默认隐藏学校、班级、家庭备注和账号信息。</span>`;
  }
  const advanced = card.querySelector("[data-v4-share-advanced]");
  if (advanced && audience === "custom") advanced.open = true;
}

function v4CreateAudience(card, prefix) {
  if (card.querySelector("[data-v4-audience-step]")) return;
  const scope = card.querySelector(`[data-share-scope-box='${prefix}']`);
  if (!scope) return;
  scope.classList.add("v4-share-scope");
  const step = document.createElement("div");
  step.className = "v4-share-step";
  step.dataset.v4AudienceStep = "1";
  step.innerHTML = `<div class="v4-step-label"><span>2</span><strong>准备给谁看？</strong></div><div class="v4-audience"><button type="button" data-v4-audience="family" class="is-active"><strong>家人</strong><small>成绩 + 排名 + 变化</small></button><button type="button" data-v4-audience="teacher"><strong>老师</strong><small>学业轨迹，隐藏家庭信息</small></button><button type="button" data-v4-audience="custom"><strong>自定义</strong><small>自己选择字段</small></button></div><div class="v4-privacy-summary" data-v4-privacy-summary></div>`;
  scope.after(step);
  step.querySelectorAll("[data-v4-audience]").forEach((button) => button.addEventListener("click", () => v4SetShareAudience(prefix, button.dataset.v4Audience, card)));
  scope.querySelectorAll(`input[name='${prefix}-scope-v2']`).forEach((input) => input.addEventListener("change", () => v4SetShareAudience(prefix, card.dataset.v4Audience || "family", card)));
  v4SetShareAudience(prefix, "family", card);
}

function v4CollapseShareAdvanced(card, prefix) {
  if (card.querySelector("[data-v4-share-advanced]")) return;
  const checkGrid = card.querySelector(".check-grid");
  if (!checkGrid) return;
  const mode = card.querySelector(`#${prefix}-mode`)?.closest(".field");
  const expiry = prefix === "secret" ? card.querySelector("#secret-expiry")?.closest(".field") : null;
  const details = document.createElement("details");
  details.className = "v4-share-advanced";
  details.dataset.v4ShareAdvanced = "1";
  details.innerHTML = `<summary>修改分享内容与有效期</summary><div class="v4-share-advanced-body"></div>`;
  const body = details.querySelector(".v4-share-advanced-body");
  if (mode) body.append(mode);
  if (expiry) body.append(expiry);
  body.append(checkGrid);
  const action = card.querySelector("[data-action='create-secret'], [data-action='create-public']");
  action?.before(details);
}

function v4SimplifySecretCard(card) {
  if (!card || card.dataset.v4Share === "1") return;
  const scope = card.querySelector("[data-share-scope-box='secret']");
  if (!scope) return;
  card.dataset.v4Share = "1";
  card.querySelector("h3").textContent = "生成分享链接";
  const intro = card.querySelector("p.muted");
  if (intro) intro.textContent = "默认使用私密链接。先决定分享哪一段轨迹，再决定给谁看。";
  const stepLabel = document.createElement("div");
  stepLabel.className = "v4-step-label";
  stepLabel.innerHTML = `<span>1</span><strong>想分享什么？</strong>`;
  scope.prepend(stepLabel);
  v4CreateAudience(card, "secret");
  v4CollapseShareAdvanced(card, "secret");
  const action = card.querySelector("[data-action='create-secret']");
  if (action) {
    action.textContent = "生成并复制链接";
    action.classList.add("v4-share-generate");
  }
}

function v4CollapsePublicCard(grid, card) {
  if (!grid || !card || card.closest("[data-v4-public-details]")) return;
  const details = document.createElement("details");
  details.className = "v4-public-details";
  details.dataset.v4PublicDetails = "1";
  details.innerHTML = `<summary><span><strong>公开主页</strong><small>高级选项 · 无需登录访问，但仍默认 noindex</small></span><span aria-hidden="true">＋</span></summary>`;
  card.before(details);
  details.append(card);
  card.classList.add("v4-public-card");
}

function v4EnhanceSharing(main) {
  const grid = main.querySelector(".share-grid");
  if (!grid) return;
  const cards = [...grid.querySelectorAll(":scope > .share-card")];
  const secret = cards[0] || grid.querySelector(".share-card");
  const publicCard = cards[1] || grid.querySelector(".v4-public-card");
  if (secret?.querySelector("[data-share-scope-box='secret']")) {
    v4SimplifySecretCard(secret);
    if (publicCard) v4CollapsePublicCard(grid, publicCard);
    return;
  }
  if (grid.dataset.v4ShareWatch === "1") return;
  grid.dataset.v4ShareWatch = "1";
  const observers = [];
  for (const card of cards) {
    const observer = new MutationObserver(() => {
      if (secret?.querySelector("[data-share-scope-box='secret']")) {
        v4SimplifySecretCard(secret);
        if (publicCard) v4CollapsePublicCard(grid, publicCard);
        observers.forEach((item) => item.disconnect());
      }
    });
    observer.observe(card, { childList: true });
    observers.push(observer);
  }
  setTimeout(() => observers.forEach((item) => item.disconnect()), 2500);
}

function v4HumanizeExamForm(form) {
  if (!form || form.dataset.v4Humanized === "1") return false;
  const context = form.querySelector(".exam-context-grid");
  const comparison = form.querySelector(".v3-comparison-fields:not(.v3-joint-rank-fields)");
  const joint = form.querySelector("[data-v3-joint-rank-fields]");
  const overallRanks = form.querySelector(".exam-overall-ranks");
  if (!context || !comparison || !overallRanks) return false;
  form.dataset.v4Humanized = "1";

  const levelSelect = comparison.querySelector("[name='comparisonLevel']");
  const levelField = levelSelect?.closest(".field");
  if (levelField) {
    levelField.querySelector("label").textContent = "考试范围（可选）";
    const note = levelField.querySelector("small");
    if (note) note.textContent = "用于说明这次考试覆盖范围；趋势仍先按考试类别判断是否可比。";
    context.append(levelField);
  }

  const seriesField = comparison.querySelector("[name='comparisonSeries']")?.closest(".field");
  if (seriesField) {
    seriesField.querySelector("label").textContent = "属于同一个考试系列（可选）";
    const note = seriesField.querySelector("small");
    if (note) note.textContent = "例如“2027届三次模拟考试”。只有同类别且至少两次同系列时，系统才优先用这一组判断趋势。";
    const more = document.createElement("details");
    more.className = "v4-more-comparison";
    more.innerHTML = `<summary>更多比较信息（可选）</summary><div></div>`;
    more.querySelector("div").append(seriesField);
    context.insertAdjacentElement("afterend", more);
  }
  comparison.remove();

  if (joint) {
    const rank = joint.querySelector("[name='overall-joint-rank-v3']");
    const people = joint.querySelector("[name='overall-joint-participants-v3']");
    if (rank && people) {
      const row = document.createElement("div");
      row.className = "exam-rank-row v4-joint-rank-row";
      row.dataset.v4JointRank = "1";
      row.innerHTML = `<div class="exam-rank-label">联考</div><div class="exam-rank-pair"><span data-v4-joint-rank-slot></span><span class="exam-rank-slash">/</span><span data-v4-joint-people-slot></span><span class="exam-rank-unit">人</span></div>`;
      row.querySelector("[data-v4-joint-rank-slot]").replaceWith(rank);
      row.querySelector("[data-v4-joint-people-slot]").replaceWith(people);
      overallRanks.append(row);
      const type = form.querySelector("[name='type']");
      const sync = () => {
        const visible = type?.value === "joint";
        row.hidden = !visible;
        rank.disabled = !visible;
        people.disabled = !visible;
      };
      type?.addEventListener("change", sync);
      sync();
    }
    joint.remove();
  }
  return true;
}

function v4WatchExamForm(form) {
  if (!form || form.dataset.v4Watch === "1") return;
  if (v4HumanizeExamForm(form)) return;
  form.dataset.v4Watch = "1";
  const observer = new MutationObserver(() => {
    if (v4HumanizeExamForm(form)) observer.disconnect();
  });
  observer.observe(form, { childList: true });
  setTimeout(() => observer.disconnect(), 2500);
}

function v4SettingsNav(main) {
  if (main.querySelector("[data-v4-settings-nav]")) return;
  const section = main.querySelector(":scope > section");
  if (!section) return;
  const head = section.querySelector(":scope > .section-head");
  if (!head) return;
  const nav = document.createElement("nav");
  nav.className = "v4-settings-nav";
  nav.dataset.v4SettingsNav = "1";
  nav.setAttribute("aria-label", "设置任务");
  nav.innerHTML = `<button type="button" data-v4-settings-target="profile-form"><strong>孩子资料</strong><small>昵称、学校、班级、选科</small></button><button type="button" data-v4-settings-target="family-management"><strong>家庭成员</strong><small>账号、权限与孩子</small></button><button type="button" data-v4-settings-target="independent-invite-panel"><strong>邀请新家庭</strong><small>一次性邀请，数据彼此隔离</small></button><button type="button" data-v4-settings-target="account-recovery-panel"><strong>账号与恢复</strong><small>密码与恢复码</small></button>`;
  head.after(nav);
  nav.querySelectorAll("[data-v4-settings-target]").forEach((button) => button.addEventListener("click", () => {
    const target = main.querySelector(`#${button.dataset.v4SettingsTarget}, .${button.dataset.v4SettingsTarget}`);
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  }));
}

function v4EnhanceSettings(main) {
  v4SettingsNav(main);
  const profile = main.querySelector("#profile-form");
  if (profile) profile.dataset.v4SettingsSection = "profile";
  const family = main.querySelector(".family-management");
  if (family) family.id = "family-management";
  const recovery = main.querySelector(".account-recovery-panel");
  const invite = main.querySelector(".independent-invite-panel");
  if (recovery) recovery.id = "account-recovery-panel";
  if (invite) invite.id = "independent-invite-panel";
  if (main.dataset.v4SettingsWatch === "1" || (family && recovery)) return;
  main.dataset.v4SettingsWatch = "1";
  const observer = new MutationObserver(() => v4EnhanceSettings(main));
  observer.observe(main, { childList: true });
  const activeSection = main.querySelector(":scope > section");
  if (activeSection) observer.observe(activeSection, { childList: true });
  setTimeout(() => observer.disconnect(), 2500);
}

function v4FieldByName(form, name) {
  return form.querySelector(`[name='${name}']`)?.closest(".field") || null;
}

function v4JoinStep(form, index) {
  const steps = [...form.querySelectorAll("[data-v4-join-step]")];
  const next = Math.max(0, Math.min(index, steps.length - 1));
  steps.forEach((step, i) => { step.hidden = i !== next; });
  form.dataset.v4JoinIndex = String(next);
  const progress = form.querySelector("[data-v4-join-progress]");
  if (progress) progress.textContent = `${next + 1} / ${steps.length}`;
}

function v4ValidateJoinStep(form, index) {
  const step = form.querySelectorAll("[data-v4-join-step]")[index];
  if (!step) return true;
  for (const input of step.querySelectorAll("input, select")) {
    if (!input.checkValidity()) {
      input.reportValidity();
      return false;
    }
  }
  const password = step.querySelector("[name='password']")?.value;
  const confirm = step.querySelector("[name='confirmPassword']")?.value;
  if (password != null && confirm != null && password !== confirm) {
    step.querySelector("[name='confirmPassword']")?.setCustomValidity("两次输入的密码不一致");
    step.querySelector("[name='confirmPassword']")?.reportValidity();
    step.querySelector("[name='confirmPassword']")?.setCustomValidity("");
    return false;
  }
  return true;
}

function v4EnhanceJoin(form) {
  if (!form || form.dataset.v4Join === "1") return;
  const grid = form.querySelector(".onboarding-grid");
  if (!grid) return;
  form.dataset.v4Join = "1";
  const definitions = [
    { title: "建立家庭", note: "先给这个独立家庭一个名字。", fields: ["familyName"] },
    { title: "创建登录账号", note: "账号和密码只属于这个家庭。", fields: ["username", "password", "confirmPassword"] },
    { title: "孩子资料", note: "先填最基本资料，学校和班级以后也能修改。", fields: ["displayName", "graduationYear", "schoolLabel", "className", "subjectTrack"] }
  ];
  const fragment = document.createDocumentFragment();
  definitions.forEach((definition, index) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "v4-join-step";
    fieldset.dataset.v4JoinStep = String(index);
    fieldset.innerHTML = `<legend>${definition.title}</legend><p>${definition.note}</p><div class="v4-join-fields"></div><div class="v4-join-actions">${index > 0 ? `<button type="button" class="btn btn-outline" data-v4-join-back>上一步</button>` : ""}${index < definitions.length - 1 ? `<button type="button" class="btn btn-primary" data-v4-join-next>下一步</button>` : ""}</div>`;
    const holder = fieldset.querySelector(".v4-join-fields");
    definition.fields.forEach((name) => {
      const field = v4FieldByName(form, name);
      if (field) holder.append(field);
    });
    fragment.append(fieldset);
  });
  grid.replaceWith(fragment);
  const submitActions = form.querySelector(":scope > .onboarding-actions");
  const submit = submitActions?.querySelector("button[type='submit']");
  if (submit) submit.textContent = "创建我的家庭";
  form.insertAdjacentHTML("afterbegin", `<div class="v4-join-progress"><span>创建独立家庭</span><strong data-v4-join-progress>1 / 3</strong></div>`);
  form.querySelectorAll("[data-v4-join-next]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(form.dataset.v4JoinIndex || 0);
    if (v4ValidateJoinStep(form, index)) v4JoinStep(form, index + 1);
  }));
  form.querySelectorAll("[data-v4-join-back]").forEach((button) => button.addEventListener("click", () => v4JoinStep(form, Number(form.dataset.v4JoinIndex || 0) - 1)));
  const last = form.querySelectorAll("[data-v4-join-step]")[definitions.length - 1];
  if (last && submitActions) last.append(submitActions);
  v4JoinStep(form, 0);
}

function v4RequireRecoveryAck(root) {
  const code = root.querySelector("[data-recovery-code]");
  const finish = root.querySelector("[data-finish-recovery]");
  if (!code || !finish || root.querySelector("[data-v4-recovery-ack]")) return;
  const label = document.createElement("label");
  label.className = "v4-recovery-ack";
  label.dataset.v4RecoveryAck = "1";
  label.innerHTML = `<input type="checkbox"> <span>我已经把恢复码保存到安全的位置</span>`;
  finish.disabled = true;
  finish.closest(".onboarding-actions")?.before(label);
  label.querySelector("input")?.addEventListener("change", (event) => { finish.disabled = !event.currentTarget.checked; });
}

function v4EnhanceOnboarding() {
  const join = document.querySelector("#join-family-form");
  if (join) v4EnhanceJoin(join);
  const card = document.querySelector(".onboarding-card");
  if (card) v4RequireRecoveryAck(card);
}

async function v4Scan() {
  if (v4ScanRunning) return;
  v4ScanRunning = true;
  try {
    v4EnhanceOnboarding();
    const main = document.querySelector("main.container");
    if (!main) return;
    const active = main.querySelector(".tab.active")?.dataset.tab;
    if (active === "overview") await v4EnhanceOverview(main);
    if (active === "sharing") v4EnhanceSharing(main);
    if (active === "settings") v4EnhanceSettings(main);
  } catch {} finally {
    v4ScanRunning = false;
  }
}

const v4App = document.querySelector("#app");
if (v4App) new MutationObserver(() => queueMicrotask(v4Scan)).observe(v4App, { childList: true });

if (document.body) new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof Element)) continue;
      const form = node.matches?.("#exam-dialog") ? node.querySelector("#exam-form") : node.matches?.("#exam-form") ? node : null;
      if (form) v4WatchExamForm(form);
    }
  }
}).observe(document.body, { childList: true });

v4Scan();
v4WatchExamForm(document.querySelector("#exam-form"));
