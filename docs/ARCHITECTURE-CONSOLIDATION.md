# Architecture Consolidation — v0.13

v0.13 is an architecture-consolidation release. It does not add role-specific UI or a new data model.

## Canonical flow

raw data → domain facts → semantic state → human reading → application selectors/actions → UI

## Boundaries

1. Domain owns what an exam, score, ranking, comparison and share mean.
2. Application owns state transitions, actions and selectors.
3. UI renders view models and dispatches actions; it does not invent business rules.
4. Repository/API owns persistence and transport; UI does not know KV keys.
5. Share projection is a restricted view of the same domain facts.

## Migration policy

- `public/domain-v001.js` is the canonical client-domain facade during migration.
- Existing versioned implementation files remain compatibility implementations; new semantic logic must not be added as another versioned helper.
- `app.js` is an application shell, not a new location for domain rules.
- Student/parent/teacher are review perspectives only, never runtime roles.
- Data Schema 1, Workers KV and Share v2 remain unchanged.

## v0.13 acceptance criteria

- Score-first reading and comparison use the same metric.
- Pages consume the canonical domain facade instead of importing semantic helpers independently.
- Legacy semantic modules are compatibility implementations, not extension points.
- Architecture boundaries are protected by tests.
- Migration is incremental and does not change stored data or public links.

## v0.13.1 Exam Scope & Lifecycle

- subjectSet 是“本次实际考了哪些科”的领域事实；单科、多科、六科共享同一个 Exam 模型。
- 删除考试继续保留恢复能力，但不进入正常首页、考试列表、时间轴、历史和分享阅读路径。
- ExamEditor 根据 subjectSet 动态显示科目；保存成功自动关闭并恢复原上下文，失败保持编辑器打开。
- 窄屏编辑器使用全高滚动容器和底部 sticky 操作区；schemaVersion 1、KV 布局、Share v2 URL 不变。
