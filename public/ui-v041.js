const V41_SHARE_FIELDS = [
  ["displayName", "昵称"],
  ["graduationYear", "毕业年份"],
  ["school", "学校"],
  ["className", "班级"],
  ["overallScore", "总分"],
  ["overallRank", "总体排名"],
  ["subjectScores", "六科成绩"],
  ["subjectRanks", "六科排名"]
];

let v41ScanRunning = false;

function v41Esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function v41Text(node) {
  return node?.textContent?.trim() || "";
}

function v41Scope(card, prefix) {
  return card.querySelector(`input[name='${prefix}-scope-v2']:checked`)?.value || "single";
}

function v41ShareDefaults(scope) {
  return {
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
}

function v41ApplyShareDefaults(card, prefix) {
  const scope = v41Scope(card, prefix);
  const defaults = v41ShareDefaults(scope);
  for (const [key, checked] of Object.entries(defaults)) {
    const input = card.querySelector(`[name='${prefix}-${key}']`);
    if (input) input.checked = checked;
  }
}

function v41ShareSummary(card, prefix) {
  const scope = v41Scope(card, prefix);
  const fields = V41_SHARE_FIELDS.filter(([key]) => card.querySelector(`[name='${prefix}-${key}']`)?.checked).map(([, label]) => label);
  const includeHistory = scope === "trajectory";
  const scopeText = scope === "trajectory" ? "高三轨迹" : "这一次考试";
  const included = [scopeText, "考试名称和日期", ...fields];
  if (includeHistory) included.push("历次考试和位置变化");
  const summary = card.querySelector("[data-v41-share-summary]");
  if (!summary) return;
  summary.innerHTML = `<div><strong>将分享</strong><span>${v41Esc([...new Set(included)].join("、"))}</span></div><div><strong>不会分享</strong><span>家庭备注、登录账号、家庭成员和安全信息</span></div>`;
}

function v41NormalizeScopeLabels(card, prefix) {
  const box = card.querySelector(`[data-share-scope-box='${prefix}']`);
  if (!box) return false;
  box.querySelector(":scope > strong")?.remove();
  const oldStep = box.querySelector(":scope > .v4-step-label");
  if (oldStep) oldStep.remove();
  if (!box.querySelector("[data-v41-share-title]")) {
    const title = document.createElement("div");
    title.className = "v41-share-title";
    title.dataset.v41ShareTitle = "1";
    title.innerHTML = `<strong>想分享什么？</strong><small>只需要决定分享这一次，还是分享一段轨迹。</small>`;
    box.prepend(title);
  }
  const trajectory = box.querySelector(`input[name='${prefix}-scope-v2'][value='trajectory']`)?.closest("label");
  const single = box.querySelector(`input[name='${prefix}-scope-v2'][value='single']`)?.closest("label");
  if (trajectory) trajectory.querySelector("span").textContent = "高三轨迹";
  if (single) single.querySelector("span").textContent = "这一次考试";
  return true;
}

function v41SimplifyShareCard(card, prefix) {
  if (!card) return false;
  const box = card.querySelector(`[data-share-scope-box='${prefix}']`);
  if (!box) return false;

  card.querySelectorAll("[data-v4-audience-step], .v3-teacher-preset").forEach((node) => node.remove());
  v41NormalizeScopeLabels(card, prefix);

  if (prefix === "secret") {
    const intro = card.querySelector("p.muted");
    if (intro) intro.textContent = "默认使用私密链接。选择要分享的内容，确认范围后直接生成。";
  }

  const advanced = card.querySelector("[data-v4-share-advanced]");
  if (advanced) {
    const summary = advanced.querySelector(":scope > summary");
    if (summary) summary.textContent = prefix === "secret" ? "修改分享内容与有效期" : "修改分享内容";
  }

  if (!card.querySelector("[data-v41-share-summary]")) {
    const summary = document.createElement("div");
    summary.className = "v41-share-summary";
    summary.dataset.v41ShareSummary = "1";
    (advanced || card.querySelector("[data-action='create-secret'], [data-action='create-public']"))?.before(summary);
  }

  if (card.dataset.v41Defaults !== "1") {
    v41ApplyShareDefaults(card, prefix);
    card.dataset.v41Defaults = "1";
  }

  if (card.dataset.v41Bound !== "1") {
    card.dataset.v41Bound = "1";
    box.querySelectorAll(`input[name='${prefix}-scope-v2']`).forEach((input) => input.addEventListener("change", () => {
      if (card.dataset.v41Customized !== "1") v41ApplyShareDefaults(card, prefix);
      v41ShareSummary(card, prefix);
    }));
    card.querySelectorAll(".check-grid input[type='checkbox']").forEach((input) => input.addEventListener("change", () => {
      card.dataset.v41Customized = "1";
      v41ShareSummary(card, prefix);
    }));
  }

  const action = card.querySelector("[data-action='create-secret']");
  if (action) action.textContent = "生成并复制链接";
  v41ShareSummary(card, prefix);
  return true;
}

function v41WatchShareCard(card, prefix) {
  if (!card || card.dataset.v41Watch === "1" || v41SimplifyShareCard(card, prefix)) return;
  card.dataset.v41Watch = "1";
  const observer = new MutationObserver(() => {
    if (v41SimplifyShareCard(card, prefix)) observer.disconnect();
  });
  observer.observe(card, { childList: true });
  setTimeout(() => observer.disconnect(), 2500);
}

function v41EnhanceShareComposer(main) {
  const grid = main.querySelector(".share-grid");
  if (!grid) return;
  const cards = [...grid.querySelectorAll(":scope > .share-card, :scope > [data-v4-public-details] > .share-card")];
  const secret = cards.find((card) => card.querySelector("#secret-mode")) || grid.querySelector(".share-card");
  const publicCard = cards.find((card) => card.querySelector("#public-mode"));
  v41WatchShareCard(secret, "secret");
  v41WatchShareCard(publicCard, "public");
}

function v41CoordinatePrimary(card) {
  const rankCards = [...card.querySelectorAll(".rank-grid .rank-card")];
  const school = rankCards.find((item) => v41Text(item.querySelector("small")).includes("学校"));
  const clazz = rankCards.find((item) => v41Text(item.querySelector("small")).includes("班级"));
  const schoolStrong = v41Text(school?.querySelector("strong"));
  const schoolHints = school ? [...school.querySelectorAll("small")].slice(1).map(v41Text).filter(Boolean) : [];
  const schoolPctRaw = schoolHints.find((text) => /^前\s*\d/.test(text));
  const schoolPct = schoolPctRaw?.split("·")[0]?.trim() || null;
  const classStrong = v41Text(clazz?.querySelector("strong"));
  const total = v41Text(card.querySelector(".latest-score strong"));
  const exam = v41Text(card.querySelector(".latest-score span"));
  const primary = schoolPct || (schoolStrong && schoolStrong !== "—" ? schoolStrong : classStrong && classStrong !== "—" ? classStrong : "位置未分享");
  const primaryLabel = schoolPct || (schoolStrong && schoolStrong !== "—") ? "学校相对位置" : classStrong && classStrong !== "—" ? "班级位置" : "当前坐标";
  return { primary, primaryLabel, schoolStrong, classStrong, total, exam };
}

function v41EnhanceCurrentCoordinate(shell) {
  const card = shell.querySelector(":scope > .card");
  if (!card || card.dataset.v41Coordinate === "1") return;
  card.dataset.v41Coordinate = "1";
  card.classList.add("v41-current-coordinate");
  const source = v41CoordinatePrimary(card);
  const summary = document.createElement("div");
  summary.className = "v41-coordinate-primary";
  const meta = [];
  if (source.schoolStrong && source.schoolStrong !== "—" && source.primary !== source.schoolStrong) meta.push(`校 ${source.schoolStrong}`);
  if (source.classStrong && source.classStrong !== "—") meta.push(`班 ${source.classStrong}`);
  if (source.total && source.total !== "—") meta.push(`${source.total} 分`);
  summary.innerHTML = `<small>${v41Esc(source.primaryLabel)}</small><strong>${v41Esc(source.primary)}</strong>${meta.length ? `<span>${v41Esc(meta.join(" · "))}</span>` : ""}${source.exam ? `<em>${v41Esc(source.exam)}</em>` : ""}`;
  const latest = card.querySelector(".latest-score");
  if (latest) latest.before(summary);
  latest?.classList.add("v41-source-hidden");
  card.querySelector(".rank-grid")?.classList.add("v41-source-hidden");
}

function v41NormalizeTrajectory(root) {
  root.querySelectorAll(".v3-perspective-bar, .v3-teacher-preset").forEach((node) => node.remove());
  const deepCopy = root.querySelector("[data-v4-deep-dive] > summary small");
  if (deepCopy) deepCopy.textContent = "单科历史、六科变化和可比考试";
  root.querySelectorAll(".v3-six-map h2").forEach((node) => { node.textContent = "六科变化怎么走"; });
  root.querySelectorAll(".v3-six-summary").forEach((node) => {
    node.textContent = node.textContent.replace("建议核对：", "值得留意：");
  });
}

function v41NormalizeExternalPanel(section) {
  const panel = section.querySelector("[data-v3-external-panel]");
  if (!panel) return;
  const overall = panel.querySelector("[data-v3-overall]");
  if (overall) {
    overall.classList.add("v41-change-surface");
    const heading = overall.querySelector(".section-head h2");
    if (heading) heading.textContent = "最近变化";
    const articles = [...overall.querySelectorAll(".v3-summary-grid > article")];
    articles.forEach((article, index) => article.classList.toggle("v41-summary-hidden", index !== 1));
    const recentLabel = articles[1]?.querySelector("small");
    if (recentLabel) recentLabel.textContent = "和上一次可比考试相比";
  }
  const six = panel.querySelector(".v3-six-map");
  if (six) {
    const heading = six.querySelector("h2");
    if (heading) heading.textContent = "六科变化怎么走";
    const summary = six.querySelector(".v3-six-summary");
    if (summary) summary.textContent = summary.textContent.replace("建议核对：", "值得留意：");
  }
  v41NormalizeTrajectory(panel);
}

function v41BindExternal(section) {
  if (!section || section.dataset.v41Bound === "1") return;
  section.dataset.v41Bound = "1";
  section.addEventListener("click", () => queueMicrotask(() => v41NormalizeExternalPanel(section)));
  v41NormalizeExternalPanel(section);
}

function v41TimelineState(section) {
  if (!section) return;
  const nodes = [...section.querySelectorAll("[data-timeline-exam]")];
  for (const node of nodes) {
    const latest = node.classList.contains("is-current") || node.classList.contains("is-latest");
    node.classList.toggle("is-latest", latest);
    const selected = node.getAttribute("aria-selected") === "true";
    node.classList.toggle("is-viewing", selected && !latest);
    const label = node.querySelector("span");
    if (label) label.textContent = latest ? "最新" : selected ? "正在查看" : "历史";
  }
}

function v41EnhanceTimeline(section) {
  if (!section || section.dataset.v41Timeline === "1") return;
  section.dataset.v41Timeline = "1";
  v41TimelineState(section);
  section.querySelectorAll("[data-timeline-exam]").forEach((button) => button.addEventListener("click", () => queueMicrotask(() => v41TimelineState(section))));
}

function v41EnhancePublicShell(shell) {
  if (!shell) return;
  v41EnhanceCurrentCoordinate(shell);
  const external = shell.querySelector("[data-v3-external]");
  if (external) {
    shell.querySelectorAll(".share-comparison-section").forEach((node) => node.classList.add("v41-legacy-comparison-hidden"));
    v41BindExternal(external);
  }
  v41EnhanceTimeline(shell.querySelector("[data-share-timeline-v2]"));
  v41NormalizeTrajectory(shell);

  if (shell.dataset.v41Watch !== "1") {
    shell.dataset.v41Watch = "1";
    const observer = new MutationObserver(() => {
      const section = shell.querySelector("[data-v3-external]");
      if (section) v41BindExternal(section);
      v41EnhanceTimeline(shell.querySelector("[data-share-timeline-v2]"));
      shell.querySelectorAll(".share-comparison-section").forEach((node) => {
        if (shell.querySelector("[data-v3-external]")) node.classList.add("v41-legacy-comparison-hidden");
      });
      v41NormalizeTrajectory(shell);
    });
    observer.observe(shell, { childList: true });
    setTimeout(() => observer.disconnect(), 4000);
  }
}

function v41NormalizePrivate(main) {
  try {
    if (localStorage.getItem("score:v030:perspective") === "student") localStorage.removeItem("score:v030:perspective");
  } catch {}
  v41NormalizeTrajectory(main);
}

function v41Scan() {
  if (v41ScanRunning) return;
  v41ScanRunning = true;
  try {
    const main = document.querySelector("main.container");
    if (main) {
      v41EnhanceShareComposer(main);
      v41NormalizePrivate(main);
    }
    v41EnhancePublicShell(document.querySelector(".public-shell"));
  } finally {
    v41ScanRunning = false;
  }
}

const v41App = document.querySelector("#app");
if (v41App) {
  const observer = new MutationObserver(() => queueMicrotask(v41Scan));
  observer.observe(v41App, { childList: true });
}

v41Scan();
