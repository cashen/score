import {
  comparisonEligibility,
  comparisonReason,
  comparisonCategory,
  percentile,
  comparableRanking,
  findComparableExam,
  comparableSet,
  rankingState
} from "./record-semantics-v120.js";

export {
  comparisonEligibility,
  comparisonReason,
  comparisonCategory,
  percentile,
  comparableRanking,
  findComparableExam,
  comparableSet
};

export function rankingFor(rankings, preferredScopes = ["school", "class"]) {
  for (const scope of preferredScopes) {
    const ranking = rankingState(rankings, scope);
    if (ranking.exists) return ranking.item;
  }
  return null;
}
