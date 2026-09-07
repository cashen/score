const SUBJECTS = [
  ["chinese", "语文", 150],
  ["math", "数学", 150],
  ["english", "英语", 150],
  ["physics", "物理", 100],
  ["chemistry", "化学", 100],
  ["biology", "生物", 100]
];

function fieldByName(form, name) {
  const control = form.elements.namedItem(name);
  return control?.closest?.(".field") || null;
}

function controlByName(form, name) {
  return form.elements.namedItem(name) || null;
}

function section(title, hint = "") {
  const el = document.createElement("section");
  el.className = "exam-section";
  el.innerHTML = `<div class="exam-section-head"><div><h3>${title}</h3>${hint ? `<p>${hint}</p>` : ""}</div></div>`;
  return el;
}

function labeledControl(label, control, className = "") {
  const wrap = document.createElement("label");
  wrap.className = `exam-control ${className}`.trim();
  const text = document.createElement("span");
  text.className = "exam-control-label";
  text.textContent = label;
  wrap.append(text, control);
  return wrap;
}

function rankPair(label, rankInput, participantsInput) {
  const wrap = document.createElement("div");
  wrap.className = "exam-rank-row";
  const title = document.createElement("span");
  title.className = "exam-rank-label";
  title.textContent = label;

  rankInput.placeholder = "名次";
  participantsInput.placeholder = "总人数";
  rankInput.setAttribute("aria-label", `${label}名次`);
  participantsInput.setAttribute("aria-label", `${label}总人数`);

  const pair = document.createElement("div");
  pair.className = "exam-rank-pair";
  const slash = document.createElement("span");
  slash.className = "exam-rank-slash";
  slash.textContent = "/";
  const unit = document.createElement("span");
  unit.className = "exam-rank-unit";
  unit.textContent = "人";
  pair.append(rankInput, slash, participantsInput, unit);
  wrap.append(title, pair);
  return wrap;
}

function buildOverview(form, oldGrid) {
  const overview = section("这次是什么考试", "先把考试身份确认清楚；不知道的数据可以以后再补。");
  const grid = document.createElement("div");
  grid.className = "exam-context-grid";

  const names = ["name", "date", "type", "dataStatus"];
  for (const name of names) {
    const field = fieldByName(form, name);
    if (field) grid.append(field);
  }
  overview.append(grid);

  const overall = section("总分与整体位置", "总分是结果，排名更适合观察孩子在同一群体里的相对位置。");
  const summary = document.createElement("div");
  summary.className = "exam-overall-grid";

  const official = fieldByName(form, "officialScore");
  if (official) {
    official.querySelector("label")?.replaceChildren("学校公布总分");
    summary.append(official);
  }
  const status = fieldByName(form, "status");
  if (status) {
    status.querySelector("label")?.replaceChildren("这次发挥");
    summary.append(status);
  }

  const ranks = document.createElement("div");
  ranks.className = "exam-overall-ranks";
  const classRank = controlByName(form, "overall-class-rank");
  const classPeople = controlByName(form, "overall-class-participants");
  const schoolRank = controlByName(form, "overall-school-rank");
  const schoolPeople = controlByName(form, "overall-school-participants");
  if (classRank && classPeople) ranks.append(rankPair("班级", classRank, classPeople));
  if (schoolRank && schoolPeople) ranks.append(rankPair("学校", schoolRank, schoolPeople));
  summary.append(ranks);
  overall.append(summary);

  oldGrid.before(overview, overall);
  oldGrid.remove();
}

function buildSubjectCard(form, key, label, fullScore) {
  const mode = controlByName(form, `${key}-mode`);
  const full = controlByName(form, `${key}-full`);
  const raw = controlByName(form, `${key}-raw`);
  const final = controlByName(form, `${key}-final`);
  const classRank = controlByName(form, `${key}-class-rank`);
  const classPeople = controlByName(form, `${key}-class-participants`);
  const schoolRank = controlByName(form, `${key}-school-rank`);
  const schoolPeople = controlByName(form, `${key}-school-participants`);
  if (![mode, full, raw, final, classRank, classPeople, schoolRank, schoolPeople].every(Boolean)) return null;

  const card = document.createElement("article");
  card.className = "exam-subject-card";
  card.dataset.subject = key;

  const head = document.createElement("div");
  head.className = "exam-subject-head";
  head.innerHTML = `<div><h4>${label}</h4><span>常用满分 ${fullScore}</span></div>`;
  card.append(head);

  const scoreGrid = document.createElement("div");
  scoreGrid.className = "exam-subject-score-grid";
  const modeWrap = labeledControl("计分方式", mode);
  const fullWrap = labeledControl("满分", full);
  const rawWrap = labeledControl("原始分", raw, "exam-primary-score");
  const finalWrap = labeledControl("赋分后", final, "exam-converted-score");
  scoreGrid.append(modeWrap, fullWrap, rawWrap, finalWrap);
  card.append(scoreGrid);

  const rankBlock = document.createElement("div");
  rankBlock.className = "exam-subject-ranks";
  rankBlock.append(rankPair("班级", classRank, classPeople), rankPair("学校", schoolRank, schoolPeople));
  card.append(rankBlock);

  const syncMode = () => {
    const converted = mode.value === "raw_and_converted" || mode.value === "converted";
    finalWrap.hidden = !converted;
    final.disabled = !converted;
    rawWrap.querySelector(".exam-control-label").textContent = converted ? "原始分" : "成绩";
  };
  mode.addEventListener("change", syncMode);
  mode.dataset.examModeBound = "1";
  mode.syncExamMode = syncMode;
  syncMode();

  return card;
}

function syncSubjectModes(form) {
  for (const [key] of SUBJECTS) {
    const mode = controlByName(form, `${key}-mode`);
    if (mode?.dataset.examModeBound === "1" && typeof mode.syncExamMode === "function") mode.syncExamMode();
  }
}

function buildSubjects(form, subjectEditor) {
  const oldGrid = subjectEditor.querySelector(".score-editor-grid");
  const title = subjectEditor.querySelector("h3");
  if (!oldGrid || !title) return;

  subjectEditor.classList.add("exam-section", "exam-subject-section");
  title.textContent = "六科成绩与排名";
  const hint = document.createElement("p");
  hint.className = "exam-section-hint";
  hint.textContent = "按科目逐个填：先成绩，再排名。没有公布的排名直接留空。";
  title.after(hint);

  const cards = document.createElement("div");
  cards.className = "exam-subject-cards";
  for (const [key, label, full] of SUBJECTS) {
    const card = buildSubjectCard(form, key, label, full);
    if (card) cards.append(card);
  }
  oldGrid.replaceWith(cards);
}

function enhanceExamForm(form) {
  if (!form || form.dataset.humanized === "1") return;
  form.dataset.humanized = "1";
  form.classList.add("exam-dialog-human");
  document.documentElement.classList.add("exam-dialog-open");

  const head = form.querySelector(".dialog-head");
  const oldGrid = form.querySelector(".form-grid");
  const subjectEditor = form.querySelector(".subject-editor");
  if (!head || !oldGrid || !subjectEditor) return;

  const subtitle = document.createElement("div");
  subtitle.className = "exam-dialog-subtitle";
  subtitle.textContent = "从整体到单科，按你拿到成绩单时的顺序填写。";
  head.querySelector("h2")?.after(subtitle);

  buildOverview(form, oldGrid);
  buildSubjects(form, subjectEditor);

  const notes = form.querySelector("textarea[name='notes']")?.closest(".field");
  if (notes) {
    notes.classList.add("exam-notes");
    notes.querySelector("label")?.replaceChildren("想记住的事（仅家庭内部）");
  }

  form.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    form.querySelector("[data-close-dialog]")?.click();
  });
}

function scan() {
  const form = document.querySelector("#exam-form");
  if (form) {
    enhanceExamForm(form);
    if (form.querySelector(".notice-box")?.textContent?.includes("已恢复本机未同步草稿")) syncSubjectModes(form);
  } else {
    document.documentElement.classList.remove("exam-dialog-open");
  }
}

const observer = new MutationObserver(scan);
observer.observe(document.documentElement, { childList: true, subtree: true });
scan();
