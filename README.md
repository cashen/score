# 高三轨迹（Score）

家庭用的高三模拟考试轨迹工具：记录语文、数学、英语、物理、化学、生物的成绩与班级/学校排名，更强调“相对位置变化”，而不是把不同难度试卷的绝对分数机械横比。

## v0.1 技术基线

- Cloudflare Worker + Static Assets
- Workers KV（不使用 R2 / D1）
- GitHub 只保存源码，不保存孩子成绩
- 原生 HTML/CSS/JS，无第三方前端 SDK
- 一个家庭可以容纳多个成员/多个孩子的数据模型；第一版建户默认 1 owner + 1 student

## 已实现

- 家庭账号登录
- PBKDF2 + per-user salt + Worker Secret pepper
- HttpOnly / Secure / SameSite=Strict 签名 Session Cookie
- CSRF 防护与 host-only Cookie
- 六科原始分 / 最终分 / 赋分模式
- 每科班级、学校排名及参与人数
- 总分、总班排、总校排
- 数据不完整可先保存
- 一次考试一个 KV key
- revision 冲突提示
- 修改前历史版本保存
- 孩子资料编辑
- 完整 JSON 导出
- 私密随机链接
- 可撤销公开主页
- 实时分享 / 固定快照
- 分享字段白名单
- 公开/分享页面默认 noindex
- 家庭备注永不通过分享 API 输出
- Android / Pad / PC 响应式单页

## 为什么现在用 KV

当前项目目标是不依赖信用卡/计费验证，并且用户现有 D1 免费额度已被其他业务占用。成绩记录是典型低频写入：一次考试通常只发生创建和少量补录。KV 的最终一致性边界被显式保留在架构中，不把它伪装成事务数据库。

详见：

- `docs/ARCHITECTURE.md`
- `docs/DATA-CONTRACT.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`

## 本地检查

```bash
npm ci
npm run verify
```

## Cloudflare 部署

见 `docs/DEPLOYMENT.md`。必须先创建一个 Workers KV namespace，并设置三个 Worker Secrets：

- `SESSION_SECRET`
- `AUTH_PEPPER`
- `ADMIN_BOOTSTRAP_SECRET`

这些 Secret **不能**提交到 GitHub。

## 数据隐私

默认状态是 Private。Public 并不等于 Searchable：即使家庭主动创建公开主页，v0.1 也会返回 `noindex, nofollow, noarchive`，不会提供公开学生目录、搜索或排行榜。
