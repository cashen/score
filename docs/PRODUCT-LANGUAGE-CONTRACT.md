# Product Language Contract v0.12.22

## Purpose
This is the user-facing semantic constitution for 高三坐标. It sits above the data contract and below individual pages. A feature is complete only when the same fact is described consistently across editor, overview, history, trajectory, sharing, export, loading, empty and error states.

## Four layers
1. Fact — what stored data says.
2. Relationship — what two or more stored facts can be compared to.
3. Explanation — a short human explanation of why a section can or cannot say more.
4. Conclusion — any statement about ability, psychology, risk or future outcome.
The product may expose facts, relationships and bounded explanations. It must not turn one score change into a conclusion about ability, character, effort, health, or future admission.

## Canonical terms
| Concept | Canonical wording | Avoid |
| --- | --- | --- |
| officialScore | 总分 | 六科合计 when the source is official total |
| six complete, no official total | 六科合计 | 总分 |
| partial subjects | X/6 科小计 | 总分、六科合计 |
| school rank | 校内第 X 名 | 校第 X 名 |
| class rank | 班级第 X 名 | 班第 X 名 |
| school percentile | 校内前 X% | 校前 X% |
| joint rank | 联考第 X 名 | 校内第 X 名 |
| current viewed exam | 这次考试 | 最近一次 when another exam is open |
| immediately previous exam | 上一场考试 | 最近一次 when chronology matters |
| latest chronological exam | 最近一次考试 | 上一次考试 |
| all history | 历次考试 / 历次成绩 | 整体位置、长期变化 |
| no comparable exam | 暂时没有可以直接比较的考试 | 没有可比记录、口径不同 |

## Score rule
- officialScore exists -> 总分
- no official total + six subjects complete -> 六科合计
- fewer than six subjects -> X/6 科小计
- no subject score -> no subtotal and never zero
overall.calculatedScore is a checking value; it is not automatically displayed as 总分.

## Ranking rule
Always preserve scope: school -> 校内第 X 名; class -> 班级第 X 名; joint -> 联考第 X 名; percentile -> 校内前 X%. Never mix scopes in one ranking series.

## Time semantics
- 这次考试 = the exam currently opened/edited/viewed.
- 上一场考试 = immediately preceding exam chronologically.
- 最近一次考试 = latest exam chronologically.
- 最近一次有记录的成绩 = use only when the latest exam exists but has no usable score data and the distinction matters.
- 以前 = history before the current exam.
- 历次 = all relevant history.
Never silently replace 上一场考试 with 最近一次可比较的考试.

## Comparison states
1. First record: 这是第一次记录。
2. History but no direct comparison: 暂时没有可以直接比较的考试。 Add a concrete reason when useful.
3. Direct comparison: 和 9 月 1 日相比……
4. Several comparable records: 最近几次……
5. Long history: 从最早一次到现在……
Internal terms such as 可比记录、变化结论、变化来源 are not user-facing vocabulary.

## Information hierarchy
- Primary: the fact the user came to see.
- Secondary: the most useful relationship to that fact.
- Supporting: history and context.
- Technical: identifiers and algorithm boundaries.
- Hidden: information with no user value in the current state.
Empty or technically unavailable sections should normally be hidden rather than filled with explanations about the algorithm.

## Share privacy rule
Audit the full chain: stored field -> share projection -> derived summary -> trend/history -> UI -> export/image. A field excluded from the share allow-list must not reappear through any derived sentence, trend, aggregate, image, or alternate page.

## Acceptance questions
- Is this a fact, relationship, explanation, or conclusion?
- Which stored field supports it?
- Are current/previous/latest terms chronologically correct?
- Is total vs six-subject sum vs partial subtotal explicit?
- Is ranking scope explicit?
- Does it reveal a field excluded from sharing?
- Does it expose internal algorithm terminology?
- Does insufficient data cause the module to disappear instead of inventing a conclusion?
- Is the same concept named the same way elsewhere?
- Does it remain understandable on a narrow mobile screen?