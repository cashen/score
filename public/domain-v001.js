/** Canonical client domain facade for the v0.13 migration. */
import { SUBJECT_KEYS, comparisonCategory, comparisonReason, comparisonEligibility, comparableSet, comparableRanking, findComparableExam, findComparableExamForSubject, latestExam, metricBetween as coreMetricBetween, percentile, rankingState, sortExamsChronologically, subjectRecordState } from "./record-semantics-v120.js";
import { examScoreSummary, examCompleteness, scoreSummaryText, subjectScore } from "./score-core-v090.js";
import { changeDrivers, subjectObservationExams } from "./trajectory-analysis-v010.js";
import { formatComparisonState, formatComparisonSummary, formatExamScore, formatMissingSubjects, formatRanking, formatShareMode } from "./product-language-v001.js";
import { scoreDeltaParts, shouldShowScoreDelta, scoreChangeSentence, scoreChangeDetail } from "./record-reading-v130.js";
import { resolveDisplayMetric, recordCompleteness, recordSaveSummary, shareBehaviorLabel } from "./human-reading-v140.js";
import { resolveExamScope, normalizeSubjectSet, subjectKeysForDisplay, subjectLabel, subjectLabels, examScopeLabel, examScoreLabel, EXAM_SCOPE_VERSION } from "./exam-scope.js";

export { SUBJECT_KEYS, comparisonCategory, comparisonReason, comparisonEligibility, comparableSet, comparableRanking, findComparableExam, findComparableExamForSubject, latestExam, percentile, rankingState, sortExamsChronologically, subjectRecordState, examScoreSummary, examCompleteness, scoreSummaryText, subjectScore, changeDrivers, subjectObservationExams, formatComparisonState, formatComparisonSummary, formatExamScore, formatMissingSubjects, formatRanking, formatShareMode, scoreDeltaParts, shouldShowScoreDelta, scoreChangeSentence, scoreChangeDetail, resolveDisplayMetric, recordCompleteness, recordSaveSummary, shareBehaviorLabel, resolveExamScope, normalizeSubjectSet, subjectKeysForDisplay, subjectLabel, subjectLabels, examScopeLabel, examScoreLabel };

// One comparison rule for the whole application: auto comparison follows the metric actually displayed.
export function metricBetween(latest, previous, key = null, metric = "auto") {
  const resolved = resolveDisplayMetric(latest, key, metric);
  return coreMetricBetween(latest, previous, key, resolved);
}

export const DOMAIN_ARCHITECTURE_VERSION = EXAM_SCOPE_VERSION;
