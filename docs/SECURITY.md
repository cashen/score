# Security Contract

## 默认原则

1. 默认私有；没有显式 share grant 就没有外部入口。
2. 授权在 Worker 服务端执行，前端隐藏字段不构成权限控制。
3. 公共/私密分享使用白名单投影，新字段默认拒绝公开。
4. 家长备注永不由分享 API 返回。
5. 公开页和私密分享页都设置 `noindex, nofollow, noarchive`。
6. `Referrer-Policy: no-referrer`，避免分享 token 通过 Referer 泄漏。
7. CSP 禁止第三方脚本、frame、object；应用本身不加载广告/统计 SDK。
8. Session Cookie 不设置 `Domain`，保持 host-only。

## 必需 Worker Secrets

- `SESSION_SECRET`: 随机高熵字符串，用于 Session HMAC。
- `AUTH_PEPPER`: 与用户 salt 不同的服务端 secret，用于密码派生。
- `ADMIN_BOOTSTRAP_SECRET`: 管理员建户接口 Bearer token。

这些值不得提交 GitHub，也不得写进浏览器 JS。

## v0.12.28 安全收口

- 邀请、恢复码、恢复链接的一次性消费由 SQLite-backed Durable Object `OneTimeCredentialGate` 串行化；成绩数据继续保存在 Workers KV。
- 新生成 Secret Share 使用 URL fragment 保存原始 token；页面读取后立即移除 fragment，再通过同源 POST redeem；旧 path 格式继续兼容。
- Session payload 增加随机 `jti`；服务端保存短期 session record。普通退出删除当前 session record，改密码、退出所有设备和恢复密码仍通过 `sessionVersion` 撤销旧 Session。由于 session record 当前保存在 Workers KV，普通退出的跨 POP 撤销受 KV 最终一致性影响，不宣称零传播延迟。
- `BOOTSTRAP_ENABLED` 默认关闭；临时开启时成功创建一次后写入 `bootstrap:completed`，之后永久关闭该入口。
- 分享创建、撤销、公开兑换均有限流；429 响应带 `Retry-After`。
- Workers invocation logs 显式关闭，避免默认 invocation 日志记录请求 URL 中的新 Secret Share token。
- 前端坐标分析对持久化考试名称做 HTML escaping；不允许把成绩输入直接当 HTML。

## 已知边界

Workers KV 是最终一致存储，`revision` 是家庭低频编辑场景的冲突保护，不是跨 POP 的强事务锁。若未来出现大量家庭成员同时编辑同一场考试，应把“单场考试写入协调”迁移到具备强串行能力的存储/协调层，而无需重写前端数据契约。

## Workers Free CPU 与密码派生

Workers Free 的每请求 CPU 预算较紧。v0.1 默认 `PASSWORD_ITERATIONS=20000`，并额外依赖不进入 KV 的 `AUTH_PEPPER`。这是免费运行预算下的工程折中，不把它描述成密码学最优参数。部署后应观察登录请求 CPU；如果实际环境余量允许，可逐步提高迭代并在下一次改密码时升级 credential record。
