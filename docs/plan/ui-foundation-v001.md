# 我的高三 UI Foundation v0.14.0.0

## 目标

建立全站统一、安静、可靠、包容的 UI 基础层，为后续首页、考试录入、阅读与分享重构提供单一视觉基线。

本阶段只处理视觉基础与可访问性交互约束，不改变考试、成绩、比较、家庭、分享、Schema 1、Workers KV 或 API 行为。

## 产品原则

- 学生成绩是记录，不是评价；UI 不用强烈红绿制造奖惩感。
- 高三早期、中期、后期都使用同一套信息语言，不要求切换角色模式。
- 学生、家长、教师阅读同一份事实时，都先看到事实，再看到解释。
- 数据少不是错误；缺少排名、总分或历史记录不能被视觉表现成失败。
- 主要操作清楚，次要操作弱化；一屏尽量只有一个主要行动。
- 手机、Pad、PC 均保持相同的信息层级。

## S1 — Design System Foundation

- 新增 `public/css/ui-foundation-v001.css`，作为现有 `app-v094.css` 之后唯一的最终 UI 基础覆盖层。
- 建立统一的页面背景、表面、文字、辅助文字、分隔线、品牌色、状态色、间距、圆角、阴影与焦点令牌。
- 统一 body、标题、表单、按钮、tabs、card、dialog、status、empty state 的基础节奏。
- 交互目标尺寸统一到至少 44px，尤其兼顾 Android/Pad 触摸。
- 提供 `:focus-visible`、`prefers-reduced-motion`、`prefers-contrast`、`forced-colors` 基础约束。
- 不把颜色作为唯一状态表达方式。

## S2 — 后续页面重构边界

后续 PR 按以下顺序实施：

1. 首页与导航：让首页首先回答“现在在哪 / 最近变化 / 变化来自哪里”。
2. 考试录入：把填写体验统一成一张自然的成绩记录，不增加新的业务模式。
3. 成绩阅读与分享：统一总成绩 / 单科 / 时间轴的阅读节奏，降低卡片堆叠。
4. 家庭与设置：降低后台管理感，保持家庭数据和权限语义不变。
5. 全站清理：淘汰重复 CSS 覆盖，保留必要的历史兼容文件但不继续追加孤立视觉版本。

## 验收

### 自动化
- `npm run verify`
- UI foundation contract
- 现有 UI / product / security / sharing regression

### 浏览器
- Chromium 360 / 390 / 768 / 1280
- WebKit 390
- 触摸场景、键盘焦点、窄屏布局
- reduced motion / high contrast 基础检查

### 边界
- 不改 Schema 1
- 不改 Workers KV key
- 不改 Share v2 URL
- 不改家庭角色模型
- 不改成绩与比较算法
- 不改 API contract

## Release Gate

只有 exact tested PR head 通过 CI，并完成 main SHA 与 production attestation 后才进入下一阶段。
