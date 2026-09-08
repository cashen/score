export const SUBJECTS = ["chinese", "math", "english", "physics", "chemistry", "biology"];
export const ROLES = new Set(["owner", "editor", "viewer"]);
export const EXAM_TYPES = new Set(["weekly", "monthly", "midterm", "final", "school", "joint", "mock1", "mock2", "mock3", "other"]);
export const SCORE_MODES = new Set(["raw", "converted", "raw_and_converted"]);
export const COMPARISON_LEVELS = new Set(["school", "alliance", "district", "city", "province", "other"]);

export function examComparisonCategory(value) {
  const type = typeof value === "string" ? value : value?.type;
  if (type === "joint" || type === "school") return "joint_school";
  if (["mock1", "mock2", "mock3"].includes(type)) return "mock";
  return EXAM_TYPES.has(type) ? type : "other";
}

export function comparableExamCategory(a, b) {
  return examComparisonCategory(a) === examComparisonCategory(b);
}

export function normalizeUsername(value) {
  return String(value || "").trim().normalize("NFKC").toLowerCase();
}

export function assertUsername(value) {
  const normalized = normalizeUsername(value);
  if (normalized.length < 3 || normalized.length > 64) throw new Error("账号长度需为 3–64 个字符");
  if (/\s/.test(normalized)) throw new Error("账号不能包含空格");
  return normalized;
}

export function assertPassword(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 256) {
    throw new Error("密码长度需为 10–256 个字符");
  }
  return value;
}

export function safeText(value, max = 120) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

export function normalizePublicSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  if (slug.length < 3 || slug.length > 50 || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    throw new Error("公开地址需为 3–50 位字母、数字或短横线，短横线不要放在开头或结尾");
  }
  return slug;
}

function integerOrNull(value, min = 0, max = 10000000) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error("存在无效整数值");
  return n;
}

function numberOrNull(value, min = 0, max = 10000) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("存在无效分数值");
  return Math.round(n * 10) / 10;
}

export function normalizeRankings(rankings) {
  if (!Array.isArray(rankings)) return [];
  return rankings.slice(0, 8).map((item) => {
    const rank = integerOrNull(item?.rank, 1);
    const participants = integerOrNull(item?.participants, 1);
    if (rank != null && participants != null && rank > participants) throw Object.assign(new Error("排名不能大于参与人数"), { code: "rank_exceeds_participants", field: "rank" });
    return {
      scope: safeText(item?.scope, 32) || "school",
      label: safeText(item?.label, 60),
      rank,
      participants,
      basis: safeText(item?.basis, 24) || "final_score"
    };
  });
}

export function normalizeSubject(value = {}) {
  const scoreMode = SCORE_MODES.has(value.scoreMode) ? value.scoreMode : "raw";
  const fullScore = numberOrNull(value.fullScore, 1, 1000);
  const rawScore = numberOrNull(value.rawScore, 0, 1000);
  const finalScore = numberOrNull(value.finalScore, 0, 1000);
  if (fullScore != null && rawScore != null && rawScore > fullScore) throw Object.assign(new Error("原始分不能高于满分"), { code: "score_exceeds_full", field: "rawScore" });
  return { scoreMode, fullScore, rawScore, finalScore, rankings: normalizeRankings(value.rankings) };
}

export function normalizeComparison(value = {}) {
  const series = safeText(value?.series, 60);
  const level = COMPARISON_LEVELS.has(value?.level) ? value.level : null;
  return series || level ? { series, level } : null;
}

export function normalizeExam(input, existing = null) {
  const id = existing?.id || safeText(input.id, 80) || crypto.randomUUID();
  const subjects = {};
  for (const subject of SUBJECTS) subjects[subject] = normalizeSubject(input.subjects?.[subject] || {});
  const date = safeText(input.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw Object.assign(new Error("考试日期无效"), { code: "invalid_exam_date", field: "date" });
  const type = EXAM_TYPES.has(input.type) ? input.type : "other";
  const officialScore = numberOrNull(input.overall?.officialScore, 0, 2000);
  const calculatedScore = SUBJECTS.reduce((sum, key) => {
    const score = subjects[key].finalScore ?? subjects[key].rawScore;
    return score == null ? sum : sum + score;
  }, 0);
  const comparison = input.comparison === undefined ? (existing?.comparison || null) : normalizeComparison(input.comparison);
  return {
    schemaVersion: 1,
    id,
    name: safeText(input.name, 80) || "未命名考试",
    date,
    type,
    status: ["normal", "good", "poor", "absent", "partial"].includes(input.status) ? input.status : "normal",
    context: {
      grade: safeText(input.context?.grade, 30),
      semester: safeText(input.context?.semester, 20),
      classLabel: safeText(input.context?.classLabel, 60),
      schoolLabel: safeText(input.context?.schoolLabel, 100)
    },
    comparison,
    overall: {
      officialScore,
      calculatedScore: Math.round(calculatedScore * 10) / 10,
      rankings: normalizeRankings(input.overall?.rankings)
    },
    subjects,
    notes: safeText(input.notes, 1500),
    dataStatus: input.dataStatus === "complete" ? "complete" : "partial",
    revision: existing ? existing.revision + 1 : 1,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export const DEFAULT_SHARE_FIELDS = Object.freeze({
  displayName: true,
  graduationYear: true,
  school: false,
  className: false,
  overallScore: true,
  overallRank: true,
  subjectScores: true,
  subjectRanks: true,
  history: true,
  examStatus: false,
  comparisonContext: false,
  status: false,
  comparison: false
});

export function normalizeShareFields(input = {}) {
  const result = {};
  for (const key of Object.keys(DEFAULT_SHARE_FIELDS)) result[key] = input[key] ?? DEFAULT_SHARE_FIELDS[key];
  return result;
}

export function percentile(rank, participants) {
  if (!Number.isInteger(rank) || !Number.isInteger(participants) || rank < 1 || participants < rank) return null;
  return Math.round((rank / participants) * 1000) / 10;
}

export function comparableRanking(a, b) {
  if (!a || !b) return false;
  return a.scope === b.scope && (a.label || "") === (b.label || "") && a.basis === b.basis;
}

export function publicProjection(student, exams, fields) {
  const result = {
    student: {
      displayName: fields.displayName ? student.displayName : null,
      graduationYear: fields.graduationYear ? student.graduationYear : null,
      schoolLabel: fields.school ? student.schoolLabel || null : null,
      className: fields.className ? student.className || null : null
    },
    exams: []
  };
  for (const exam of exams) {
    const projected = {
      id: exam.id,
      name: exam.name,
      date: exam.date,
      type: exam.type
    };
    if (fields.examStatus || fields.status) projected.status = exam.status || "normal";
    if (fields.comparisonContext || fields.comparison) projected.comparison = exam.comparison ? { series: exam.comparison.series || null, level: exam.comparison.level || null } : null;
    if (fields.overallScore) projected.overallScore = exam.overall?.officialScore ?? exam.overall?.calculatedScore ?? null;
    if (fields.overallRank) projected.overallRankings = exam.overall?.rankings || [];
    if (fields.subjectScores || fields.subjectRanks) {
      projected.subjects = {};
      for (const subject of SUBJECTS) {
        const source = exam.subjects?.[subject] || {};
        projected.subjects[subject] = {};
        if (fields.subjectScores) {
          projected.subjects[subject].rawScore = source.rawScore ?? null;
          projected.subjects[subject].finalScore = source.finalScore ?? null;
          projected.subjects[subject].scoreMode = source.scoreMode || "raw";
        }
        if (fields.subjectRanks) projected.subjects[subject].rankings = source.rankings || [];
      }
    }
    result.exams.push(projected);
  }
  return result;
}
