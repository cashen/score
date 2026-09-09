const WIDTH = 1080;
const MAX_HEIGHT = 6000;

function xml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]));
}

function score(exam) {
  if (exam?.overall?.officialScore != null) return `${exam.overall.officialScore}`;
  if (exam?.overallScore != null) return `${exam.overallScore}`;
  const values = Object.values(exam?.subjects || {}).map((item) => Number(item?.finalScore ?? item?.rawScore)).filter(Number.isFinite);
  return values.length ? `${values.reduce((sum, value) => sum + value, 0)}` : "—";
}

function ranking(exam, scope) {
  return (exam?.overallRankings || exam?.overall?.rankings || []).find((item) => item?.scope === scope && item.rank != null)?.rank ?? "—";
}

function subjectScore(exam, key) {
  const item = exam?.subjects?.[key];
  return item?.finalScore ?? item?.rawScore ?? "—";
}

function line(text, x, y, size = 30, weight = 400, fill = "#242525", anchor = "start") {
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" font-family="-apple-system,BlinkMacSystemFont,'Noto Sans SC','PingFang SC',sans-serif">${xml(text)}</text>`;
}

export function shareProjectionRows({ data = {}, share = {}, view = "timeline", subject = "chinese" } = {}) {
  const exams = Array.isArray(data.exams) ? data.exams : [];
  const fields = share.fields || {};
  const rows = view === "subject" ? exams.map((exam) => ({ label: exam.name || "考试", date: exam.date || "", value: fields.subjectScores === false ? "未分享" : subjectScore(exam, subject), detail: fields.subjectRanks === false ? "" : `校 ${exam?.subjects?.[subject]?.rankings?.find((item) => item.scope === "school")?.rank ?? "—"}` })) : exams.map((exam) => ({ label: exam.name || "考试", date: exam.date || "", value: fields.overallScore === false ? "未分享" : score(exam), detail: fields.overallRank === false ? "" : `校 ${ranking(exam, "school")} · 班 ${ranking(exam, "class")}` }));
  return rows;
}

export function buildShareSvg({ data = {}, share = {}, view = "timeline", subject = "chinese" } = {}) {
  const rows = shareProjectionRows({ data, share, view, subject });
  const name = share.fields?.displayName === false ? "学生" : data.student?.displayName || "学生";
  const title = view === "subject" ? "单科轨迹" : view === "total" ? "总成绩坐标" : "考试时间轴";
  const maxRows = Math.max(1, Math.min(rows.length, 42));
  const height = Math.min(MAX_HEIGHT, 300 + maxRows * 108);
  const visibleRows = rows.slice(0, maxRows);
  const subjectLabel = subject === "math" ? "数学" : subject === "english" ? "英语" : subject === "physics" ? "物理" : subject === "chemistry" ? "化学" : subject === "biology" ? "生物" : "语文";
  const header = [line("高三坐标", 70, 82, 28, 700, "#5e8581"), line(title, 70, 150, 56, 750), line(name, 70, 205, 30, 500, "#5b625f"), line(view === "subject" ? subjectLabel : share.scope === "trajectory" ? "成长轨迹 · 分享白名单" : "本次考试 · 分享白名单", WIDTH - 70, 150, 24, 500, "#5b625f", "end")].join("");
  const rowsSvg = visibleRows.map((row, index) => {
    const y = 320 + index * 108;
    const shade = index % 2 ? "#f5f5f0" : "#fbfbf7";
    return `<rect x="60" y="${y - 56}" width="960" height="88" rx="14" fill="${shade}" stroke="#d7dad2"/>${line(row.label, 88, y - 16, 25, 650)}${line(row.date || "", 88, y + 18, 20, 400, "#727974")}${line(row.value, 690, y - 8, 34, 750, "#242525", "end")}${line(row.detail, 990, y + 21, 20, 400, "#727974", "end")}`;
  }).join("");
  const footer = rows.length > maxRows ? line(`时间轴较长，已分为前 ${maxRows} 条；网页仍可查看完整记录。`, 70, height - 62, 20, 400, "#727974") : line("页面只包含家庭主动选择的分享字段。", 70, height - 62, 20, 400, "#727974");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="title desc"><title id="title">${xml(title)}</title><desc id="desc">${xml(name)}的${xml(title)}分享图</desc><rect width="100%" height="100%" fill="#fbfbf7"/>${header}<line x1="70" y1="245" x2="1010" y2="245" stroke="#c8cec7" stroke-width="2"/>${rowsSvg}${footer}</svg>`;
}

function svgBlob(svg) {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

export async function svgToPngBlob(svg, scale = 2) {
  if (typeof document === "undefined" || typeof Image === "undefined") throw new Error("当前浏览器不支持图片导出");
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器不支持画布导出");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片生成失败")), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function openShareSvgPreview(svg) {
  const url = URL.createObjectURL(svgBlob(svg));
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return Boolean(opened);
}

export async function deliverShareImage({ data, share, view = "timeline", subject = "chinese", filename = "gaosan-coordinate-share.png" } = {}) {
  const svg = buildShareSvg({ data, share, view, subject });
  try {
    const blob = await svgToPngBlob(svg);
    const file = typeof File === "function" ? new File([blob], filename, { type: "image/png" }) : null;
    if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try { await navigator.share({ title: "高三坐标分享", text: "这是我的考试记录", files: [file] }); return { mode: "shared", message: "已调用系统分享" }; } catch (error) { if (error?.name === "AbortError") return { mode: "cancelled", message: "已取消分享" }; }
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { mode: "downloaded", message: "分享图已开始下载" };
  } catch {
    openShareSvgPreview(svg);
    return { mode: "preview", message: "当前浏览器无法直接下载，已打开图片预览；可长按保存" };
  }
}
