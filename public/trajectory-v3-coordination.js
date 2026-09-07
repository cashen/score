const V3_COORD_LEVELS = [
  ["school", "校内"],
  ["alliance", "校际/联盟"],
  ["district", "区县"],
  ["city", "市级"],
  ["province", "省级"],
  ["other", "其他"]
];

let v3CoordMe = null;

async function v3CoordJson(path) {
  const response = await fetch(path, { credentials: "same-origin" });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function v3CoordEnsureComparisonFields() {
  const form = document.querySelector("#exam-form");
  if (!form || form.querySelector(".v3-comparison-fields")) return;
  const subjectEditor = form.querySelector(".subject-editor");
  if (!subjectEditor) return;

  const block = document.createElement("div");
  block.className = "v3-comparison-fields";
  block.innerHTML = `<div class="field"><label>可比组（可不填）</label><input name="comparisonSeries" maxlength="60" placeholder="例如 2027届辽宁模考"><small>同一系列考试填写同一个名字，系统会优先在这一组里比较。</small></div><div class="field"><label>考试层级（可不填）</label><select name="comparisonLevel"><option value="">未标注</option>${V3_COORD_LEVELS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><small>用于提醒不同口径考试不要机械横比。</small></div>`;
  subjectEditor.insertAdjacentElement("beforebegin", block);

  try {
    v3CoordMe = v3CoordMe || await v3CoordJson("/api/me");
    const studentId = document.querySelector("#student-select")?.value || v3CoordMe?.students?.[0]?.id;
    if (!studentId || !form.isConnected) return;
    const payload = await v3CoordJson(`/api/students/${encodeURIComponent(studentId)}/exams`);
    if (!form.isConnected) return;
    const name = form.querySelector("[name='name']")?.value;
    const date = form.querySelector("[name='date']")?.value;
    const existing = (payload?.exams || []).find((exam) => exam.name === name && exam.date === date);
    if (!existing?.comparison) return;
    const series = block.querySelector("[name='comparisonSeries']");
    const level = block.querySelector("[name='comparisonLevel']");
    if (series && !series.value) series.value = existing.comparison.series || "";
    if (level && !level.value) level.value = existing.comparison.level || "";
  } catch {}
}

function v3CoordApplyTeacherPreset(prefix, button) {
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
  const note = button.closest(".share-card")?.querySelector("[data-v3-coord-teacher-note]");
  if (note) note.textContent = "已选择总体与单科成绩/排名/历史；默认不带学校、班级身份信息。家庭备注永不分享。";
}

function v3CoordAttachTeacherPreset(box) {
  if (!box || box.querySelector("[data-v3-teacher-preset], [data-v3-coord-teacher-preset]")) return true;
  const prefix = box.dataset.shareScopeBox;
  if (!prefix) return false;
  const wrap = document.createElement("div");
  wrap.className = "v3-teacher-preset";
  wrap.innerHTML = `<button type="button" class="btn btn-outline btn-small" data-v3-coord-teacher-preset="${prefix}">给老师看</button><small data-v3-coord-teacher-note>一键选择老师最需要的学业轨迹字段；默认不分享学校和班级身份信息。</small>`;
  box.append(wrap);
  wrap.querySelector("button")?.addEventListener("click", (event) => v3CoordApplyTeacherPreset(prefix, event.currentTarget));
  return true;
}

function v3CoordWatchShareCard(card) {
  if (!card || card.dataset.v3CoordWatching === "1") return;
  card.dataset.v3CoordWatching = "1";
  const tryAttach = () => {
    const box = card.querySelector(".share-scope-v2");
    if (!box) return false;
    v3CoordAttachTeacherPreset(box);
    return true;
  };
  if (tryAttach()) return;
  const observer = new MutationObserver(() => {
    if (tryAttach()) observer.disconnect();
  });
  observer.observe(card, { childList: true });
  setTimeout(() => observer.disconnect(), 2000);
}

function v3CoordRemoveLegacySummary(root) {
  if (!root) return;
  if (root.querySelector("[data-v3-external], [data-v3-private-trajectory]") && root.querySelector("[data-trajectory-v2]")) {
    root.querySelectorAll("[data-trajectory-v2]").forEach((node) => node.remove());
  }
}

function v3CoordWatchLegacySummary(root) {
  if (!root || root.dataset.v3CoordLegacyWatch === "1") return;
  root.dataset.v3CoordLegacyWatch = "1";
  v3CoordRemoveLegacySummary(root);
  const observer = new MutationObserver(() => v3CoordRemoveLegacySummary(root));
  observer.observe(root, { childList: true });
  setTimeout(() => observer.disconnect(), 2000);
}

function v3CoordScanApp() {
  document.querySelectorAll(".share-grid .share-card").forEach(v3CoordWatchShareCard);
  const publicShell = document.querySelector(".public-shell");
  if (publicShell) v3CoordWatchLegacySummary(publicShell);
  const container = document.querySelector("main.container");
  if (container) v3CoordWatchLegacySummary(container);
}

const v3CoordApp = document.querySelector("#app");
if (v3CoordApp) new MutationObserver(() => queueMicrotask(v3CoordScanApp)).observe(v3CoordApp, { childList: true });

if (document.body) new MutationObserver(() => {
  if (document.querySelector("#exam-form")) queueMicrotask(v3CoordEnsureComparisonFields);
}).observe(document.body, { childList: true });

v3CoordScanApp();
v3CoordEnsureComparisonFields();
