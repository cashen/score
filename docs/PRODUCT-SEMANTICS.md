# Product Semantics v0.12.22

## Semantic pipeline
stored data -> fact normalization -> semantic state -> human wording -> component -> page

Pages should consume semantic states instead of independently deciding what a raw field means.

## Core states
Score: official_total, six_subject_sum, partial_subtotal, no_score.
Exam: current, previous, latest, historical.
Comparison: first_record, history_no_comparison, comparable, multiple_comparables, long_history.
Comparison reason: no_history, different_exam_type, insufficient_common_data, no_common_metric.
The reason is a machine state, not a sentence. The UI chooses the shortest human wording appropriate to the page.

## Formatting boundary
The first implementation boundary is src/lib/product-language.js.
Required pure functions: formatScoreState, formatRanking, formatMissingSubjects, formatComparisonState, formatShareMode.
They do not read KV, inspect the DOM, infer missing data, or decide page visibility.

## Visibility
A semantic state can be valid while its UI module is unnecessary. For example, history_no_comparison can be represented by one concise sentence; it does not justify a full 变化来源 module.

## No hidden fallback
The semantic layer must not silently substitute an older exam, turn partial subtotal into total, merge school and joint ranks, turn missing values into zero, or call an exam comparable merely because a numeric value exists.

## Versioning
Semantic rules are product behavior. Any change to canonical wording or semantic state updates the application version and progress marker.