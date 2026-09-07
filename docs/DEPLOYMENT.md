# Cloudflare Free 部署

本项目第一版只依赖 **Workers + Workers KV + Static Assets**，不使用 R2 / D1。

## 已绑定资源

`wrangler.toml` 已固定到当前 Cloudflare 账户与 KV namespace：

- Worker: `score-track`
- Account ID: `f0a06e40a722f0c0f7af4fe8944881e9`
- KV binding: `SCORE_KV`
- KV namespace ID: `7341ae0c8a5b43e8a249f5429691b9d0`

Account ID 与 KV namespace ID 都是资源标识，不是认证凭据。API Token、密码与 Worker Secrets 不得提交仓库。

## GitHub Actions Secrets

生产部署由 GitHub Actions 统一管理。仓库必须配置以下 4 个 **Repository secrets**：

- `CLOUDFLARE_API_TOKEN`
- `SCORE_SESSION_SECRET`
- `SCORE_AUTH_PEPPER`
- `SCORE_ADMIN_BOOTSTRAP_SECRET`

路径：GitHub → `cashen/score` → Settings → Secrets and variables → Actions → New repository secret。

后三个值必须是全新的高熵随机值；不要复用 Cloudflare、GitHub、家庭账号密码，也不要把值写进仓库、Issue、PR、Actions 日志或聊天。

部署 workflow 会在 Runner 内临时生成仅当前 job 可读的 secrets 文件，并通过 Wrangler `--secrets-file` 与代码一起上传到 Worker。文件在 job 结束前删除。`wrangler.toml` 同时声明三个运行时 Secret 为 required，缺失时部署失败。

## 2026-09-07 配置事故处理

最初曾在 Cloudflare Dashboard 将三个认证值误建为普通文本变量。Wrangler 在后续部署时把远端普通变量视为配置差异并输出到 Actions 日志，因此那批旧值必须视为已泄露并永久作废。不要再次使用旧值。

此后统一采用 GitHub Actions Secrets → Wrangler `--secrets-file` 的部署路径；常规部署同时使用 `--keep-vars`，避免覆盖 Dashboard 中其他非敏感变量。

## 验证部署

部署完成后自动访问：

```text
https://score-track.cashen.workers.dev/api/health
```

应返回 `ok: true`、应用版本、schemaVersion 与 `storage: workers-kv`。如果运行时 Secret 缺失，部署不应进入生产。

## 创建第一个家庭账户

建户接口只接受 Worker 中的 `ADMIN_BOOTSTRAP_SECRET`：

```bash
curl -X POST 'https://score-track.cashen.workers.dev/api/admin/provision' \
  -H 'Authorization: Bearer YOUR_ADMIN_BOOTSTRAP_SECRET' \
  -H 'Content-Type: application/json' \
  --data '{
    "familyName": "我的家庭",
    "username": "family001",
    "password": "replace-with-a-long-password",
    "student": {
      "displayName": "孩子昵称",
      "graduationYear": 2027,
      "grade": "高三",
      "className": "03班",
      "subjectTrack": "物化生"
    }
  }'
```

建户后可以继续保留管理员 Secret 供人工创建其他家庭；如果只创建一次，也可以之后移除 `ADMIN_BOOTSTRAP_SECRET` 并同步调整部署契约，使建户接口关闭。
