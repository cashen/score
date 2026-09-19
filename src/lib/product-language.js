const SCORE_LABELS = Object.freeze({
  official_total: '总分',
  six_subject_sum: '六科合计',
  partial_subtotal: (count) => `${count}/6 科小计`,
  no_score: ''
});

const RANKING_PREFIX = Object.freeze({ school: '校内', class: '班级', joint: '联考' });

const COMPARISON_REASONS = Object.freeze({
  no_history: '这是第一次记录。',
  different_exam_type: (count) => `暂时没有可以直接比较的考试。${count ? `之前有 ${count} 场考试，但考试类型不同。` : ''}`,
  insufficient_common_data: '暂时没有可以直接比较的考试。之前的成绩记录还不够完整。',
  no_common_metric: '暂时没有可以直接比较的考试。两场考试没有可以直接对照的数据。'
});

export function formatScoreState({ officialScore = null, subjectCount = 0, subjectTotal = null } = {}) {
  if (officialScore !== null && officialScore !== undefined) return { key: 'official_total', label: SCORE_LABELS.official_total, value: officialScore };
  if (subjectCount === 6) return { key: 'six_subject_sum', label: SCORE_LABELS.six_subject_sum, value: subjectTotal };
  if (subjectCount > 0) return { key: 'partial_subtotal', label: SCORE_LABELS.partial_subtotal(subjectCount), value: subjectTotal };
  return { key: 'no_score', label: SCORE_LABELS.no_score, value: null };
}

export function formatRanking({ scope, rank } = {}) {
  if (rank === null || rank === undefined || !RANKING_PREFIX[scope]) return '';
  return `${RANKING_PREFIX[scope]}第 ${rank} 名`;
}

export function formatMissingSubjects({ subjects = [], recorded = [] } = {}) {
  const missing = subjects.filter((subject) => !recorded.includes(subject));
  return missing.length ? `还缺：${missing.join('、')}` : '';
}

export function formatExamScore(summary = {}) {
  if (summary.kind === 'official') return `${summary.value} 分`;
  if (summary.kind === 'calculated_complete') return `六科合计 ${summary.value} 分`;
  if (summary.kind === 'calculated_partial') return `${summary.recordedSubjects}/6 科小计 ${summary.subtotal} 分`;
  if (summary.kind === 'absent') return '缺考';
  return '';
}

export function formatComparisonState({ hasHistory = false, comparable = false, reason = 'insufficient_common_data', previousDate = '', historyCount = 1 } = {}) {
  if (!hasHistory) return COMPARISON_REASONS.no_history;
  if (comparable && previousDate) return `和 ${previousDate} 相比`;
  if (comparable) return '和以前相比';
  const reasonFormatter = COMPARISON_REASONS[reason] || COMPARISON_REASONS.insufficient_common_data;
  return typeof reasonFormatter === 'function' ? reasonFormatter(historyCount) : reasonFormatter;
}

export function formatShareMode({ mode } = {}) {
  if (mode === 'live') return '这个分享页面会随着以后新增的考试一起更新。';
  if (mode === 'snapshot') return '这是创建分享时保存的内容，之后不会变化。';
  return '';
}

export const PRODUCT_LANGUAGE = Object.freeze({
  prohibitedUiTerms: Object.freeze(['口径','同口径','可比记录','变化来源','变化结论','同类别','整体位置','具体坐标','长期变化','能力提升','能力下降','状态不好','短板','严重退步','预警','诊断'])
});