# v0.13.1.1 — Exam Scope Semantic Follow-up

## Goal

在 v0.13.1.0 的 canonical Exam + subjectSet 基础上，继续收口“本次考试”的真实科目边界，避免未参加科目的历史字段影响总分计算或阻塞保存。

## Tasks

1. src/lib/model.js：存在 subjectSet 时，overall.calculatedScore 只计算选中科目；没有 scope 的旧数据保持六科兼容。
2. public/app.js：考试编辑校验只校验本次实际选择的科目；保存成功继续自动关闭，失败继续保留编辑窗口。
3. test/v01310-exam-scope.test.js：覆盖单科、多科场景下持久化计算总分与完整度。
4. public/ui-v050.css：删除 v0.13.1.0 移动端编辑器重复 CSS，保持现有视觉规则。
5. 发布版本递增至 v0.13.1.1；Schema 1、Workers KV、Share v2 URL 不变。

## Acceptance

- 单科考试即使其他科目存在旧值，calculatedScore 只包含单科。
- 多科考试只计算 subjectSet 中科目。
- 未选择科目不会因隐藏字段的旧分数/排名而阻止保存。
- 保存成功自动关闭编辑器；保存失败不关闭。
- npm run verify、Chromium/WebKit share browser regression、exact PR head verification all pass before merge.
