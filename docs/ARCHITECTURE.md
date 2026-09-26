# Architecture — 我的高三

## 目标

一个家庭级、高三一年期、低频写入的考试轨迹应用。核心观察对象是“相对位置变化”，而不是把模拟考绝对分数机械地当成能力变化。

## 运行架构

```text
GitHub cashen/score
  └─ source only
       ↓
Cloudflare Worker + Static Assets
       ├─ same-origin SPA
       ├─ auth / CSRF / authorization
       ├─ exam API
       └─ share projection API
               ↓
          Workers KV
               ↘
      OneTimeCredentialGate
      (SQLite Durable Object)
```

不依赖 R2、不依赖 D1、不要求传统数据库。

## KV Key 设计

- `username:{sha256(normalizedUsername)}` → member id mapping
- `member:{memberId}` → credential metadata / role / sessionVersion
- `family:{familyId}` → members + students
- `student:{studentId}` → current profile
- `exam-index:{studentId}` → compact exam summaries
- `exam:{studentId}:{examId}` → one exam per object
- `exam-history:{studentId}:{examId}:r{revision}` → prior revisions
- `share-index:{studentId}` → owner-visible share summaries
- `share:secret:{sha256(token)}` → secret share grant
- `share:public:{slug}` → public profile grant

一次考试一个 key，避免把孩子整个高三的成绩放进一个巨型 JSON 里互相覆盖。

## KV 最终一致性策略

Workers KV 是最终一致的，不伪装成事务数据库：

1. 每个考试对象带 `revision`。
2. 编辑时客户端提交 `expectedRevision`。
3. Worker 保存前重新读取当前对象；不一致则返回 `409 revision_conflict`。
4. 保存响应中的对象是当前设备的权威结果，UI 直接采用响应，不做“保存后立刻跨节点 GET 再确认”的反模式。
5. 同一场考试的极端跨地域并发写仍不是强串行事务；家庭级低频场景接受这一边界，并在 README 中明确。

## 身份模型

数据层不是 `user == student`：

```text
Family
 ├─ Member(owner/editor/viewer)
 └─ Student[]
      └─ Exam[]
```

一个家庭可以有多个成员和多个孩子；独立家庭邀请会创建全新的 Family 命名空间，不继承邀请人的成绩数据权限。

## Session

- 密码：PBKDF2-SHA256 + per-user salt + Worker Secret pepper，参数带版本。
- Session：HMAC 签名的 HttpOnly / Secure / SameSite=Strict Cookie，payload 带随机 `jti`。
- 服务端以 `session:{sha256(jti)}` 在 Workers KV 保存短期 session record；普通退出删除当前 record。
- `sessionVersion` 继续用于“改密码 / 退出所有设备 / 恢复密码”统一撤销旧 Session；由于 Workers KV 最终一致，普通退出的跨 POP 撤销存在短暂传播窗口。
- 写操作另需 `X-Score-CSRF`，防止同站点兄弟子域场景的 CSRF。

## 分享模型

三种实际状态：

- Private：无 share grant，只有家庭成员可访问。
- Secret：高熵随机 token；KV 只存 token hash。
- Public：固定 slug；依然 `noindex`，不做学生搜索/排行榜。

分享还分：

- `live`：按当前数据实时投影。
- `snapshot`：创建时冻结服务端投影；产品界面默认优先提供这一方式。

分享范围明确区分：

- `single`：固定到某一次指定考试。
- `trajectory`：展示多次考试，用相对位置变化作为主要观察线索。

公开数据使用 allow-list projection；新字段默认不公开。家庭内部 `notes` 没有任何对外分享开关。


## v0.13.4 dependency direction and product contracts

本版本开始，服务端 canonical domain 不再从 `public/*` 读取业务语义。考试范围、分数语义、比较语义分别位于 `src/domain/exam.js`、`src/domain/score.js`、`src/domain/comparison.js`；`src/lib/model.js` 只负责模型归一化与投影组合。

公开分享页面的关键导航文案统一由 `public/product-contract.js` 定义，浏览器回归测试直接引用同一契约，避免实现、测试和用户可见文案逐渐漂移。

依赖方向固定为：

```text
server application → src/domain → repositories
browser application → public/domain + presentation contracts
share API → explicit projection → browser
```

新业务规则不得继续增加新的带历史版本号 helper。兼容模块可以保留，但新语义必须进入 canonical domain 或明确的 presentation contract。


## v0.13.5 score-card entry

考试录入 UI 不再暴露“单科 / 多科模式”。用户只描述事实：这次实际拿到哪些成绩；`subjectSet` 仍是服务端的事实边界。

交互优先级：
1. 考试名称和日期。
2. 已拿到的成绩。
3. 需要更多科目时点击“添加另一科”。
4. 排名、考试上下文和回看信息按需填写。
5. 常用组合和上一场仅作为快捷入口，不自动修改事实。

名称推断只生成建议，不得未经用户点击写入 `subjectSet`。没有录入的数据与“没有参加该科”必须保持语义区分。
