let v42ScanRunning = false;

function v42Esc(value = "") {
  return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function v42Text(node) {
  return node?.textContent?.trim() || "";
}

function v42CompactRank(prefix, raw) {
  const value = String(raw || "").trim();
  if (!value || value === "—") return "";
  const named = value.match(/^第\s*(\d+)\s*名$/);
  if (named) return `${prefix}第 ${named[1]} 名`;
  const fraction = value.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return `${prefix}第 ${fraction[1]} 名`;
  return `${prefix}${value}`;
}

function v42CoordinateSource(card) {
  const rankCards = [...card.querySelectorAll(".rank-grid .rank-card")];
  const school = rankCards.find((item) => v42Text(item.querySelector("small")).includes("学校"));
  const clazz = rankCards.find((item) => v42Text(item.querySelector("small")).includes("班级"));
  const schoolStrong = v42Text(school?.querySelector("strong"));
  const classStrong = v42Text(clazz?.querySelector("strong"));
  const schoolHints = school ? [...school.querySelectorAll("small")].slice(1).map(v42Text).filter(Boolean) : [];
  const schoolPctRaw = schoolHints.find((text) => /^前\s*\d/.test(text));
  const schoolPct = schoolPctRaw?.split("·")[0]?.replace(/\s+/g, " ").trim() || "";
  const total = v42Text(card.querySelector(".latest-score strong"));
  const exam = v42Text(card.querySelector(".latest-score span"));
  return { schoolStrong, classStrong, schoolPct, total, exam };
}

function v42CompactCoordinate(card) {
  if (!card || card.dataset.v42Coordinate === "1") return;
  const summary = card.querySelector(".v41-coordinate-primary");
  if (!summary) return;

  const source = v42CoordinateSource(card);
  const schoolRank = v42CompactRank("校", source.schoolStrong);
  const classRank = v42CompactRank("班", source.classStrong);
  const metrics = [];

  if (schoolRank) {
    metrics.push(source.schoolPct ? `${schoolRank} · ${source.schoolPct}` : schoolRank);
  } else if (source.schoolPct) {
    metrics.push(`校${source.schoolPct}`);
  }
  if (classRank) metrics.push(classRank);
  if (source.total && source.total !== "—") metrics.push(`${source.total} 分`);
  if (!metrics.length) metrics.push("位置未分享");

  summary.classList.add("v42-coordinate-compact", "v44-coordinate-equal");
  summary.innerHTML = `${source.exam ? `<em>${v42Esc(source.exam)}</em>` : ""}<div class="v44-coordinate-row">${metrics.map((metric) => `<span class="v44-coordinate-item">${v42Esc(metric)}</span>`).join("")}</div>`;
  card.classList.add("v42-current-coordinate");
  card.dataset.v42Coordinate = "1";
}

function v42Scan() {
  if (v42ScanRunning) return;
  v42ScanRunning = true;
  try {
    const shell = document.querySelector(".public-shell");
    const card = shell?.querySelector(":scope > .card.v41-current-coordinate");
    if (card) v42CompactCoordinate(card);
  } finally {
    v42ScanRunning = false;
  }
}

const v42App = document.querySelector("#app");
if (v42App) {
  const observer = new MutationObserver(() => queueMicrotask(v42Scan));
  observer.observe(v42App, { childList: true });
}

v42Scan();
