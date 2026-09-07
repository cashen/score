# Cloudflare Free 部署

本项目第一版只依赖 **Workers + Workers KV + Static Assets**，不使用 R2 / D1。

## 已绑定资源

`wrangler.toml` 已固定到当前 Cloudflare 账户与 KV namespace：

- Worker: `score-track`
- Account ID: `f0a06e40a722f0c0f7af4fe8944881e9`
- KV binding: `SCORE_KV`
- KV namespace ID: `7341ae0c8a5b43e8a249f5429691b9d0`

Account ID 与 KV namespace ID 都是资源标识，不是认证凭据。API Token、密码与 Worker Secrets 不得提交仓库。

## 第一次自动部署

GitHub 仓库只需要配置一个 Actions secret：

- `CLOUDFLARE_API_TOKEN`

路径：GitHub → `cashen/score` → Settings → Secrets and variables → Actions → New repository secret。

Token 建议在 Cloudflare 使用 `Edit Cloudflare Workers` 模板创建，并限制到当前账户。配置完成后，重新运行 Deploy workflow 或推送一次 `main` 即可创建/更新 Worker。

## Worker 运行时 Secrets

Worker 首次部署出来以后，在 Cloudflare Dashboard：

Workers & Pages → `score-track` → Settings → Variables and Secrets

新增以下三个 **Secret**：

- `SESSION_SECRET`
- `AUTH_PEPPER`
- `ADMIN_BOOTSTRAP_SECRET`

请分别使用高熵随机值，不要复用 Cloudflare、GitHub 或家庭账号密码。它们只存 Cloudflare，不提交 GitHub。

## 验证部署

部署完成后访问：

```text
https://<你的 workers.dev 域名>/api/health
```

应返回 `ok: true`、应用版本、schemaVersion 与 `storage: workers-kv`。

## 创建第一个家庭账户

建户接口只接受 `ADMIN_BOOTSTRAP_SECRET`：

```bash
curl -X POST 'https://YOUR-WORKER.workers.dev/api/admin/provision' \
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

建户后可以继续保留管理员 Secret 供人工创建其他家庭；如果只创建一次，也可以之后删除 `ADMIN_BOOTSTRAP_SECRET`，此时建户接口会返回 404。
