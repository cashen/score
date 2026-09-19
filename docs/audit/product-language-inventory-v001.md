# Whole-site Product Language Inventory v0.12.22

## Purpose
This is the baseline inventory for the global language-governance migration. It is a map of surfaces and semantic risks, not a list of isolated copy fixes.

| Surface | Primary question | Main risk | Treatment |
| --- | --- | --- | --- |
| Home | 我现在要做什么？ | jargon / overloaded navigation | facts and actions first |
| Login / recovery | 怎么进入/找回？ | system wording | task-first |
| Onboarding | 怎么开始记录？ | setup jargon | concrete steps |
| Student profile | 这是哪个孩子？ | identity ambiguity | stable identity facts |
| Exam editor | 这次记录什么？ | total/subtotal ambiguity | score-state formatter |
| Exam detail | 这次考得怎样？ | rank scope / missing data | fact-first |
| Overview | 最近有什么变化？ | latest vs comparable fallback | comparison state |
| Subject history | 某科以前怎样？ | mixed exam categories | explicit history labels |
| Timeline | 历次考试怎样？ | duplicated analysis | compact chronology |
| Trajectory | 总体怎么变化？ | over-interpreting one change | bounded comparisons |
| Share settings | 分享什么？ | live/snapshot jargon | human descriptions |
| Single share | 别人看到什么？ | field leakage | projection-first |
| Trajectory share | 别人看到哪些历史？ | derived leakage | projection audit |
| Snapshot | 内容会不会变？ | mode ambiguity | frozen wording |
| Live share | 以后会不会更新？ | mode ambiguity | update wording |
| Export / image | 导出的是什么？ | label drift | same semantic formatters |
| Loading | 现在在做什么？ | system narration | short status |
| Empty / error | 为什么没有结果？ | internal algorithm terms | concrete reason + action |
| Mobile | 能否看懂/点击？ | truncation / duplicate blocks | browser audit |

## High-risk vocabulary
口径、同口径、可比记录、变化来源、变化结论、同类别、整体位置、具体坐标、长期变化、能力提升、能力下降、状态不好、短板、必须、严重退步、预警、诊断.
These are prohibited as default user-facing language. Tests should distinguish executable UI copy from documentation discussing the terms.

## Migration order
1. Shared semantic helpers.
2. Exam editor/detail.
3. Share projection and share pages.
4. Overview/trajectory/history.
5. Home/onboarding/recovery.
6. Loading/empty/error/toast.
7. Export/image.
8. Desktop + Android Chrome + Android Alook + Pad browser audit.

## Exit condition
All score labels use the same score-state rules; all ranking labels preserve scope; time words are chronological; comparison states have one canonical wording; share cannot leak excluded fields; empty analytical modules disappear when they add no value; CI has semantic and vocabulary regression tests; desktop and mobile behavior is verified.