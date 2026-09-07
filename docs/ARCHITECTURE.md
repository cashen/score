# Architecture — 高三坐标

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
- Session：HMAC 签名的 HttpOnly / Secure / SameSite=Strict Cookie。
- Session 无状态，不把每次登录写入 KV。
- `sessionVersion` 用于“改密码 / 退出所有设备 / 恢复密码”时统一撤销旧 Session。
- 写操作另需 `X-Score-CSRF`，防止同站点兄弟子域场景的 CSRF。

## 分享模型

三种实际状态：

- Private：无 share grant，只有家庭成员可访问。
- Secret：高熵随机 token；KV 只存 token hash。
- Public：固定 slug；依然 `noindex`，不做学生搜索/排行榜。

分享还分：

- `live`：按当前数据实时投影。
- `snapshot`：创建时冻结服务端投影。

分享范围明确区分：

- `single`：固定到某一次指定考试。
- `trajectory`：展示多次考试，用相对位置变化作为主要观察线索。

公开数据使用 allow-list projection；新字段默认不公开。家庭内部 `notes` 没有任何对外分享开关。
