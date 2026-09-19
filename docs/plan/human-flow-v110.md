# Human Flow / State Continuity — v0.11.0

## 目标

一次性修复“程序逻辑成立，但用户实际意图没有被完整执行”的问题，不做大规模视觉重构。

## A. 分享意图与数据选择

1. `src/sharing-v2.js` 成为分享创建、预览、外部读取的正式运行时。
2. 新建单场分享必须记录明确的 `examId`。
3. 历史 Share v1 记录缺少 `scope` 时按原行为解释为单场分享，避免旧链接失效。
4. Schema 1 与现有 KV key 保持不变，不做数据迁移。

## B. 单科意图

1. “单科”入口默认进入“六科概览”，不擅自选择语文。
2. 选择英语等科目表示“当前查看焦点”，不是把其他科目从系统里删除。
3. 私有端与公开端都支持 `?view=subject&subject=english`。
4. “全部六科”始终存在，用户可随时返回总览。

## C. 页面状态连续性

URL 作为可恢复的页面导航状态：
- 私有：`tab`、`view`、`subject`、`metric`、`exam`
- 公开：`view`、`subject`、`exam`

刷新、前进后退、直接深链接必须恢复对应上下文。刷新分享和家庭页面时同步重新载入所需数据。

## D. 编辑与返回路径

用户从任何页面编辑一场考试，保存后回到原来的上下文，不强制跳到“考试”列表。若当前查看考试被删除或不存在，则安全回落到列表/视图默认状态。

## E. 历史比较语义

详情页的“之前一场”必须基于选中考试的时间方向和现有可比规则查找，而不是简单寻找“第一场不同考试”。

## F. 文案与计算一致

变化结论严格按实际依据命名：
- score → 分数
- schoolRank / percentile → 学校相对位置
- classRank → 班级排名

科目回看行直接显示实际使用的指标，避免“计算依据”和“展示依据”分叉。

## G. 数据语义保护

重新编辑考试时保留已有 `good / poor / partial / absent` 状态，避免界面把多个状态压成同一个值。

同时加强两个无破坏性的模型边界：
- 分享字段只接受布尔值。
- 赋分后成绩不能高于满分。

## 验收

- `npm ci`
- `npm run verify`
- Chromium / WebKit 分享浏览器回归
- Worker Integration：单场选定考试、预览、轨迹持续更新、快照冻结、撤销、单记录持续轨迹确认
- exact PR head CI
- exact-head merge
- main CI
- Cloudflare production health：`appVersion=0.11.0`、exact `buildSha`、`schemaVersion=1`、`storage=workers-kv`

## 回滚

回滚 v0.11.0 PR。没有新增 KV migration。
