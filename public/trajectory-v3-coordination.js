const V3_COORD_LEVELS = [
  ["school", "校内"],
  ["alliance", "校际/联盟"],
  ["district", "区县"],
  ["city", "市级"],
  ["province", "省级"],
  ["other", "其他"]
];

const V3_COORD_CATEGORY_LABELS = {
  weekly: "周测",
  monthly: "月考",
  midterm: "期中",
  final: "期末",
  joint_school: "联考/校考",
  mock: "模考",
  other: "其他"
};

let v3CoordMe = null;
let v3CoordPrivateExams = [];
let v3CoordShareExams = [];
const v3CoordNativeFetch = window.fetch.bind(window);

function v3CoordCategory(type) {
  if (type === "joint" || type === "school") return "joint_school";
  if (["mock1", "mock2", "mock3"].includes(type)) return "mock";
  return V3_COORD_CATEGORY_LABELS[type] ? type : "other";
}

function v3CoordPrepareExamSet(exams) {
  if (!Array.isArray(exams)) return exams;
  const cloned = exams.map((exam) => ({
    ...exam,
    comparison: {
      ...(exam.comparison || {}),
      _storedSeries: exam.comparison?.series || null,
      _category: v3CoordCategory(exam.type)
    }
  }));
  const counts = new Map();
  for (const exam of cloned) {
    const stored = exam.comparison?._storedSeries;
    if (!stored) continue;
    const key = `${exam.comparison._category}\u0000${stored}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const exam of cloned) {
    const category = exam.comparison._category;
    const categoryLabel = V3_COORD_CATEGORY_LABELS[category] || "其他";
    const stored = exam.comparison._storedSeries;
    const sameSeriesCount = stored ? counts.get(`${category}\u0000${stored}`) || 0 : 0;
    exam.comparison.series = stored && sameSeriesCount >= 2 ? `${categoryLabel} · ${stored}` : categoryLabel;
  }
  return cloned;
}

function v3CoordJsonResponse(response, payload) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(payload), { status: response.status, statusText: response.statusText, headers });
}

function v3CoordNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

async function v3CoordFetch(input, init = {}) {
  const url = typeof input === "string" ? input : input?.url || "";
  const method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
  let nextInit = init;

  if ((method === "POST" || method === "PUT") && /\/api\/students\/[^/]+\/exams(?:\/[^/?]+)?(?:\?|$)/.test(url) && typeof init.body === "string") {
    const form = document.querySelector("#exam-form");
    if (form) {
      try {
        const body = JSON.parse(init.body);
        const type = form.querySelector("[name='type']")?.value || body.type;
        const rankings = Array.isArray(body.overall?.rankings) ? body.overall.rankings.filter((item) => item?.scope !== "joint") : [];
        if (type === "joint") {
          const rank = v3CoordNumber(form.querySelector("[name='overall-joint-rank-v3']")?.value);
          const participants = v3CoordNumber(form.querySelector("[name='overall-joint-participants-v3']")?.value);
          if (rank != null || participants != null) rankings.push({ scope: "joint", label: "联考", rank, participants, basis: "final_score" });
        }
        body.overall = { ...(body.overall || {}), rankings };
        nextInit = { ...init, body: JSON.stringify(body) };
      } catch {}
    }
  }

  const response = await v3CoordNativeFetch(input, nextInit);
  if (method !== "GET" || !response.ok) return response;
  const privateMatch = /\/api\/students\/[^/]+\/exams(?:\?|$)/.test(url);
  const shareMatch = /\/api\/share\/(?:secret|public)\//.test(url);
  if (!privateMatch && !shareMatch) return response;

  try {
    const payload = await response.clone().json();
    if (privateMatch && Array.isArray(payload.exams)) {
      payload.exams = v3CoordPrepareExamSet(payload.exams);
      v3CoordPrivateExams = payload.exams;
    }
    if (shareMatch && Array.isArray(payload.data?.exams)) {
      payload.data.exams = v3CoordPrepareExamSet(payload.data.exams);
      v3CoordShareExams = payload.data.exams;
    }
    return v3CoordJsonResponse(response, payload);
  } catch {
    return response;
  }
}

window.fetch = v3CoordFetch;

async function v3CoordJson(path) {
  const response = await fetch(path, { credentials: "same-origin" });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

function v3CoordEnsureSchoolOption(form) {
  const select = form?.querySelector("[name='type']");
  if (!select || select.querySelector("option[value='school']")) return;
  const option = document.createElement("option");
  option.value = "school";
  option.textContent = "校考";
  const other = select.querySelector("option[value='other']");
  if (other) select.insertBefore(option, other);
  else select.append(option);
}

function v3CoordJointRank(rankings) {
  return (rankings || []).find((item) => item?.scope === "joint" && item?.rank != null) || null;
}

async function v3CoordEnsureComparisonFields() {
  const form = document.querySelector("#exam-form");
  if (!form || form.dataset.v3CoordEnhanced === "1") return;
  const subjectEditor = form.querySelector(".subject-editor");
  if (!subjectEditor) return;
  form.dataset.v3CoordEnhanced = "1";
  form.dataset.v3Comparison = "1";
  v3CoordEnsureSchoolOption(form);

  const comparison = document.createElement("div");
  comparison.className = "v3-comparison-fields";
  comparison.innerHTML = `<div class="field"><label>考试系列（可不填）</label><input name="comparisonSeries" maxlength="60" placeholder="例如 2027届辽宁模考"><small>趋势先按考试类别判断是否可比；同类别里有至少两次同系列记录时，再优先比较该系列。</small></div><div class="field"><label>考试层级（可不填）</label><select name="comparisonLevel"><option value="">未标注</option>${V3_COORD_LEVELS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select><small>用于解释考试口径，不会把不同类别的考试强行合并。</small></div>`;
  subjectEditor.insertAdjacentElement("beforebegin", comparison);

  const joint = document.createElement("div");
  joint.className = "v3-comparison-fields v3-joint-rank-fields";
  joint.dataset.v3JointRankFields = "1";
  joint.innerHTML = `<div class="field"><label>联考位次</label><input name="overall-joint-rank-v3" inputmode="numeric" placeholder="例如 326"><small>只在联考时记录；用于保留联考范围内的位置。</small></div><div class="field"><label>联考人数（可不填）</label><input name="overall-joint-participants-v3" inputmode="numeric" placeholder="不知道可留空"><small>不知道总人数也可以只填联考位次。</small></div>`;
  comparison.insertAdjacentElement("afterend", joint);

  const type = form.querySelector("[name='type']");
  const syncJoint = () => {
    const visible = type?.value === "joint";
    joint.hidden = !visible;
    joint.querySelectorAll("input").forEach((input) => { input.disabled = !visible; });
  };
  type?.addEventListener("change", syncJoint);
  syncJoint();

  try {
    v3CoordMe = v3CoordMe || await v3CoordJson("/api/me");
    const studentId = document.querySelector("#student-select")?.value || v3CoordMe?.students?.[0]?.id;
    if (!studentId || !form.isConnected) return;
    const payload = await v3CoordJson(`/api/students/${encodeURIComponent(studentId)}/exams`);
    if (!form.isConnected) return;
    const name = form.querySelector("[name='name']")?.value;
    const date = form.querySelector("[name='date']")?.value;
    const existing = (payload?.exams || []).find((exam) => exam.name === name && exam.date === date);
    if (!existing) return;
    const series = comparison.querySelector("[name='comparisonSeries']");
    const level = comparison.querySelector("[name='comparisonLevel']");
    if (series && !series.value) series.value = existing.comparison?._storedSeries || "";
    if (level && !level.value) level.value = existing.comparison?.level || "";
    const jointRanking = v3CoordJointRank(existing.overall?.rankings);
    const jointRank = joint.querySelector("[name='overall-joint-rank-v3']");
    const jointPeople = joint.querySelector("[name='overall-joint-participants-v3']");
    if (jointRank && jointRanking?.rank != null) jointRank.value = jointRanking.rank;
    if (jointPeople && jointRanking?.participants != null) jointPeople.value = jointRanking.participants;
    syncJoint();
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

function v3CoordJointText(ranking) {
  if (!ranking?.rank) return "—";
  return ranking.participants ? `第 ${ranking.rank} 名 / ${ranking.participants} 人` : `第 ${ranking.rank} 名`;
}

function v3CoordDecorateJointSummary(root, exams) {
  if (!root || !Array.isArray(exams) || !exams.length) return;
  const latest = exams[0];
  if (latest.type !== "joint") return;
  const ranking = v3CoordJointRank(latest.overall?.rankings || latest.overallRankings);
  if (!ranking) return;
  const grid = root.querySelector("[data-v3-overall] .v3-summary-grid");
  if (!grid || grid.querySelector("[data-v3-joint-summary]")) return;
  const item = document.createElement("article");
  item.dataset.v3JointSummary = "1";
  item.innerHTML = `<small>联考位次</small><strong>${v3CoordJointText(ranking)}</strong><span>${ranking.participants ? "联考范围内的位置" : "联考总人数未填，仅保留位次"}</span>`;
  grid.append(item);
}

function v3CoordDecorateTimeline(exams) {
  if (!Array.isArray(exams) || !exams.length) return;
  const selected = document.querySelector("[data-timeline-exam][aria-selected='true']");
  const detail = document.querySelector(".share-timeline-detail");
  if (!selected || !detail) return;
  detail.querySelector("[data-v3-joint-timeline]")?.remove();
  const exam = exams.find((item) => item.id === selected.dataset.timelineExam);
  if (!exam || exam.type !== "joint") return;
  const ranking = v3CoordJointRank(exam.overallRankings || exam.overall?.rankings);
  if (!ranking) return;
  const metrics = detail.querySelector(".share-timeline-metrics");
  if (!metrics) return;
  const item = document.createElement("div");
  item.className = "share-timeline-metric";
  item.dataset.v3JointTimeline = "1";
  item.innerHTML = `<small>联考位次</small><strong>${v3CoordJointText(ranking)}</strong>`;
  metrics.append(item);
}

function v3CoordRemoveLegacySummary(root) {
  if (!root) return;
  if (root.querySelector("[data-v3-external], [data-v3-private-trajectory]") && root.querySelector("[data-trajectory-v2]")) {
    root.querySelectorAll("[data-trajectory-v2]").forEach((node) => node.remove());
  }
  if (root.classList?.contains("public-shell")) {
    v3CoordDecorateJointSummary(root, v3CoordShareExams);
    v3CoordDecorateTimeline(v3CoordShareExams);
  } else {
    v3CoordDecorateJointSummary(root, v3CoordPrivateExams);
  }
}

function v3CoordWatchLegacySummary(root) {
  if (!root || root.dataset.v3CoordLegacyWatch === "1") return;
  root.dataset.v3CoordLegacyWatch = "1";
  v3CoordRemoveLegacySummary(root);
  const observer = new MutationObserver(() => v3CoordRemoveLegacySummary(root));
  observer.observe(root, { childList: true });
  setTimeout(() => observer.disconnect(), 2500);
}

function v3CoordScanApp() {
  document.querySelectorAll(".share-grid .share-card").forEach(v3CoordWatchShareCard);
  const publicShell = document.querySelector(".public-shell");
  if (publicShell) v3CoordWatchLegacySummary(publicShell);
  const container = document.querySelector("main.container");
  if (container) v3CoordWatchLegacySummary(container);
}

document.addEventListener("click", (event) => {
  if (!event.target.closest?.("[data-timeline-exam]")) return;
  queueMicrotask(() => v3CoordDecorateTimeline(v3CoordShareExams));
});

const v3CoordApp = document.querySelector("#app");
if (v3CoordApp) new MutationObserver(() => queueMicrotask(v3CoordScanApp)).observe(v3CoordApp, { childList: true });

if (document.body) new MutationObserver(() => {
  if (document.querySelector("#exam-form")) queueMicrotask(v3CoordEnsureComparisonFields);
}).observe(document.body, { childList: true });

v3CoordScanApp();
v3CoordEnsureComparisonFields();
