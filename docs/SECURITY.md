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

## 已知边界

Workers KV 是最终一致存储，`revision` 是家庭低频编辑场景的冲突保护，不是跨 POP 的强事务锁。若未来出现大量家庭成员同时编辑同一场考试，应把“单场考试写入协调”迁移到具备强串行能力的存储/协调层，而无需重写前端数据契约。

## Workers Free CPU 与密码派生

Workers Free 的每请求 CPU 预算较紧。v0.1 默认 `PASSWORD_ITERATIONS=20000`，并额外依赖不进入 KV 的 `AUTH_PEPPER`。这是免费运行预算下的工程折中，不把它描述成密码学最优参数。部署后应观察登录请求 CPU；如果实际环境余量允许，可逐步提高迭代并在下一次改密码时升级 credential record。
