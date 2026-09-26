# v0.13.2.0 — Exam Semantics & Product Logic Refactor

Base: main @ 6d3af0c4631420cb6535d4dfa0684c39d211f5ca

## Goal

把“我的高三”的核心对象从“六科成绩单”进一步收口为“发生过的一次考试事件”：
- subjectSet 是本次考试的真实科目边界；
- context 是考试发生时的历史快照，编辑考试不能被当前学生资料覆盖；
- officialScore 是学校公布事实，calculatedScore/calculatedSubtotal 是派生值，并暴露不一致；
- attendance、record completeness、annotation 解耦；
- 比较按指标独立判断，不因一个特殊状态让整场考试全部不可比较；
- 单科、多科、六科在展示、分享、分析中使用同一范围语义；
- 正常页面不展示已删除考试，回收站形成可恢复闭环；
- 新建考试具备客户端幂等键，避免网络重试造成重复考试。

## Implementation scope

1. src/lib/model.js
   - 保留旧 Schema 1 兼容；
   - subjectSet 作为 canonical scope；
   - update 时继承 existing.context；
   - subjects 的计算/归一化以 subjectSet 为主；
   - 新增 scoreConsistency 派生结果；
   - 将状态拆为 attendance / dataStatus / annotation，兼容旧 status。

2. public/exam-scope.js, public/score-core-v090.js
   - 所有显示标签、合计、完整度都基于 subjectSet；
   - 单科显示“英语成绩”，多科显示“本次科目合计”，六科才显示“六科合计”；
   - 官方总分与科目合计不一致时提供可读的核对状态。

3. public/record-semantics-v120.js
   - 比较门槛从“整场考试 status 一票否决”改为按指标和数据条件判断；
   - series/level 从硬性全部一致改为强可比优先、普通可比可用；
   - ranking label 不再作为唯一身份判断；
   - 历史考试严格使用自己的 context。

4. public/human-reading-v140.js, public/trajectory-analysis-v010.js
   - 默认观察优先学校百分位/学校排名/班级排名，分数作为 fallback；
   - 单科、多科、六科文案统一；
   - 特殊/缺考/部分成绩不再把整场事实简单归为“不可比较”。

5. public/app.js
   - 编辑考试时保留历史 context；
   - 当前班级不再注入历史考试排名；
   - 展示、分享、时间轴、考试列表按真实 subjectSet；
   - 回收站入口；
   - 创建考试携带 clientRequestId；
   - 保存成功继续关闭，失败保留窗口；
   - 分享摘要不再固定写“六科”。

6. src/index.js
   - 新建考试支持 idempotency key；
   - update 保留历史 context；
   - 删除/恢复索引保持正常视图隔离。

7. test/
   - 回归覆盖：单科/多科标签、历史 context、官方总分不一致、特殊状态下指标级比较、重复创建幂等、删除不进入正常分享。

8. CHANGELOG.md, package.json, package-lock.json, wrangler.toml, .codex/progress/
   - 统一版本到 0.13.2.0。

## Gate

- CI npm run verify
- Chromium + WebKit share browser tests
- PR head exact SHA verification
- merge only after green
- post-merge main SHA verification
- production appVersion + buildSha attestation
