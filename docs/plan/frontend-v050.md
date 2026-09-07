# 高三坐标 v0.5.0 — Frontend Source-of-Truth / Human UI Consolidation

## 目标

把 v0.4.x 累积的“基础渲染 → enhancer → override → 再修补”前端链条收敛为单一、稳定、第一次就正确的用户界面。核心不是美化，而是让身份、考试、位置、变化、科目、家庭、分享自然地被理解。

设计原则：

- 少组件、少判断、少术语；让信息自己说话。
- 事实 > 判断；任务 > 系统术语；人话 > 数据库字段；解释结果 > 解释实现。
- 能用一行解决，不用一张卡。
- 手机不是“隐藏 PC 信息”，而是重新排布。
- 用户第一眼看到的 DOM 就应该接近最终 DOM，不依赖运行时多层补丁“变成人类”。
- 不改变 Worker API、KV、鉴权、分享 token 语义或考试数据 schema，除非某一步明确证明前端无法在兼容前提下完成。

## S0 — 基线、审计、断网恢复

- 冻结 base main SHA / version / production version。
- 建立 `docs/audit/frontend-v050-baseline.md`。
- 建立 `.codex/progress/frontend-consolidation-v050.json`。
- 盘点：入口资源、可见文案、所有 MutationObserver、所有运行时 DOM enhancer、所有主要页面与 360/390/768/1024/1440 断点。
- 断网恢复只认 GitHub：latest main、PR exact head、diff、CI、checkpoint。

验收：审计文件和 checkpoint 已提交；PR 为 Draft；基线 CI 事实记录完整。

## S1 — 品牌与文案单一事实源

- 源代码直接使用“高三坐标”，不再由 `brand-v021.js` 运行时替换“高三轨迹”。
- 产品名统一：`高三坐标`。
- tagline：`看见现在的位置，也看见一路的变化`。
- “轨迹”仅作为功能词，不作为产品名。
- 建立集中词典/常量，统一考试类型、角色、分享状态、系统状态文案。
- 普通 UI 禁止暴露：`token`、`noindex`、`dataStatus`、`comparisonSeries`、`comparisonLevel`、raw enum。

验收：搜索无旧品牌残留（历史 docs/test 例外需显式白名单）；登录、header、footer、onboarding 首次渲染即正确。

## S2 — 一级信息架构

一级导航改为：

- 轨迹
- 考试
- 分享
- 家庭

低频账号动作退出一级导航：

- 修改密码
- 恢复码
- 导出全部数据
- 退出
- 退出所有设备

这些进入账号/安全区域。

验收：不再用“设置”承载家庭/账号混合概念；“导出 JSON”不再与孩子切换同权。

## S3 — 首页从 Dashboard 改为连续阅读

首页信息顺序：

1. 孩子身份
2. 最近考试 + 日期
3. 同权坐标：`校第 X 名 · 班第 X 名 · X 分`
4. 如果有校总人数，补充 `校前 X% · 本次共 X 人`
5. 和上一次可比考试相比
6. `变化较明显的科目`
7. 六科 compact rows
8. `查看完整轨迹`

约束：

- 不再用“现在在哪 / 最近变化 / 变化来自哪里”三张并列 dashboard 卡。
- 删除“变化来自哪里”的因果暗示，改“变化较明显的科目”。
- 不用巨大排名制造层级。
- 一个 Hero Surface，其他信息尽量用 row / spacing / divider。

验收：3 秒测试可回答“谁 / 哪次考试 / 校 / 班 / 总分”；10 秒测试可回答“最近有无变化 / 哪几科变化明显”。

## S4 — 考试列表重新排布

每条考试记录：

- 考试名称
- 日期 · 中文考试类型
- `校第X · 班第X · X分`
- 整行进入详情

删除重复的“查看/编辑”按钮视觉噪音。手机不得通过隐藏校/班/总分换适配。

验收：360px 完整可读，无横向溢出，无关键信息隐藏。

## S5 — 考试录入收敛

第一层只保留：

- 考试名称 / 日期 / 类型
- 总分
- 校排名 / 总人数
- 班排名 / 总人数
- 六科

低频信息放“更多信息”：考试范围、考试系列、非常规满分、特殊计分方式等。

- 不让用户手工维护“数据状态”；由前端/已有数据自然反映缺失。
- “发挥较好 / 发挥失常”从一等标签移除；保留“正常 / 有特殊情况 / 缺考”，具体事实写备注。
- 草稿状态显性化：`草稿已保存在本机` / `已恢复上次未保存的内容` / `考试已保存`。

验收：第一次录入不用读说明即可按“考试 → 总体 → 六科”完成。

## S6 — 轨迹事实化

- “变化来自哪里”统一改“变化较明显的科目”。
- 弱化/移除“较稳定 / 有波动 / 波动较大”这类算法结论，优先展示事实序列或范围。
- 不把分数变化直接等同于能力变化。
- 可比性规则继续保留，但用人话解释。
- “深入看轨迹”改“查看完整轨迹”。

验收：所有趋势结论都能追溯到可见事实；没有因果过度表达。

## S7 — 分享语义清理

保留正常流程：

`想分享什么 → 将分享 / 不会分享 → 生成并复制链接`

文案：

- “私密分享链接” → “分享链接”
- “实时” → “持续更新”
- “快照” → “只分享当前内容”
- “有效期（可不填）” → “自动失效（可选）”
- “公开主页” → “公开链接（高级）”
- public 说明：`任何拿到这个地址的人都可以查看。不会主动进入搜索，但这不等于私密。`
- 不出现 `token` / `noindex` 等工程词。

验收：普通用户能回答“正在分享什么 / 别人能看见什么 / 哪些不会分享”。

## S8 — 家庭 / 账号边界

家庭页只承载：

- 家庭成员
- 孩子

账号安全承载：

- 修改密码
- 恢复码
- 退出所有设备
- 数据与备份

低频管理员能力折叠：

- 邀请另一户家庭使用高三坐标

“家庭账号”统一改为“登录账号”。
“创建一个独立家庭”改为“建立你的家庭空间”。
“独立家庭”用户文案改为“另一户家庭 / 家庭空间”，避免架构术语。

验收：家庭内部成员与另一户家庭不再需要长段解释才能区分。

## S9 — 密码修改 P0

删除浏览器 `prompt()` 改密码流程。

站内 modal：

- 当前密码
- 新密码
- 再次输入新密码
- 至少 10 个字符提示
- 提交 / loading / inline error / success

成功文案：`密码已修改，其他设备需要重新登录。`

验收：不使用 `prompt()` / `alert()` 承载核心安全流程。

## S10 — 全站状态系统

统一：

- 页面级 success / notice / error
- 按钮级 idle / loading / done
- 慢网：先“正在读取数据…”，超过阈值再提示“网络有点慢，数据还在读取。”
- 单独 `role=status` / `aria-live=polite` 状态区；`#app` 不再整体 aria-live。
- error 使用 `role=alert`。

验收：保存、分享、成员更新、恢复码、密码、网络错误的反馈模式一致。

## S11 — 前端单一事实源 / 删除补丁链

目标：最终 DOM 第一次生成即接近最终结构。

- 吸收 `brand-v021.js`、`exam-humanize.js`、`ui-v040.js`、`ui-v041.js`、`ui-v042.js` 中稳定且必要的行为到正式 renderer / view modules。
- 删除纯文本/纯布局二次改写的 enhancer。
- 不再生产加载 `ui-v040.css → ui-v041.css → ui-v042.css` override 链。
- CSS 归档为清晰职责，例如 `tokens / shell / views` 或按页面拆分。
- MutationObserver 仅用于真正的生命周期需求，不用于“发现旧 DOM 后重构成新 DOM”。
- 禁止 `subtree:true` 广域 observer。

验收：入口资源明显减少；无品牌运行时替换；公开坐标不再 v041→v042 二次重建；考试表单不再先生成旧表格再重排。

## S12 — 视觉系统纪律

只保留：

- Hero Surface：一级考试摘要
- Section Surface：功能区
- Row：考试、六科、成员、历史

规则：能用 row 不用 card。

- Hero radius ~18px
- Section radius 12–14px
- Row 默认无卡片，仅 padding / border-bottom
- 不使用红=差 / 绿=好评价学业
- 姓名 > 同权坐标字号；排名不是海报数字。

## S13 — Mobile / A11y

断点：360 / 390 / 768 / 1024 / 1440。

360 必须：

- 六科完整
- 校/班/总分完整
- 不横滚
- 不单独冒分隔符
- 主要触达 >=44px
- 考试列表不隐藏关键指标
- modal 保存按钮可达

A11y：

- `#app` 不整体 aria-live
- status / alert 语义正确
- focus-visible 一致
- summary / dialogs / forms 键盘可用

## S14 — Copy Contract / CI

新增前端文案契约测试，普通用户界面禁止：

- token
- noindex
- dataStatus
- comparisonSeries
- comparisonLevel
- raw enum
- “高三轨迹”作为产品名
- “发挥失常”
- “变化来自哪里”

并检查：

- “高三坐标”品牌唯一
- 考试类型中文
- role 中文
- 关键按钮/导航文案一致

## S15 — 全量验收

必须通过：

1. 3 秒首页测试
2. 10 秒变化测试
3. 新用户录考试测试
4. 分享理解测试
5. 360px 关键数据完整测试
6. 登录 / 忘记密码 / 邀请开户 / 恢复码
7. owner / editor / viewer 权限 UI
8. 多孩子切换
9. 私密 / public / live / snapshot 分享回归
10. 现有 API / KV / auth / share contract 回归

## Release Gate

版本：`0.5.0`

只有以下全部满足才允许合并：

- 每阶段代码和测试提交
- 最终 PR exact head CI success
- PR 从 Draft → Ready
- 合并前重新核验 main 未发生未处理漂移
- squash merge 使用 `expected_head_sha`
- main CI success
- Cloudflare deploy checkout exact merged main SHA
- `TESTED_SHA` 等于 merged main SHA
- runtime secrets 保持 hidden
- production `/api/health` 明确 `appVersion=0.5.0`

完成标准不是“代码写完”，而是生产闭环完成。