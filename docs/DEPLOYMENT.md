# Cloudflare Free 部署

本项目的第一版只依赖 **Workers + Workers KV + Static Assets**，不需要 R2 / D1。

## 1. 创建 KV Namespace

Cloudflare Dashboard → Workers & Pages → KV，创建：

- `score-production`
- 可选：`score-preview`

记下 namespace id。

## 2. 配置 `wrangler.toml`

将：

```toml
id = "REPLACE_WITH_KV_NAMESPACE_ID"
preview_id = "REPLACE_WITH_PREVIEW_KV_NAMESPACE_ID"
```

替换为真实 id。若不单独创建 preview namespace，可在本地开发时使用 Wrangler local persistence；正式部署仍必须填写 production id。

## 3. 设置 Secrets

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put AUTH_PEPPER
npx wrangler secret put ADMIN_BOOTSTRAP_SECRET
```

请使用密码管理器生成随机值，不要复用 GitHub/Cloudflare 登录密码。

## 4. 部署

```bash
npm ci
npm run verify
npx wrangler deploy
```

## 5. 创建第一个家庭账户

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

建户后建议继续保留管理员 secret 以便人工建第二个家庭；如果仅自己使用，也可以从 Worker 中移除该 secret，使接口返回 404。

## 6. GitHub Actions 自动部署（可选）

仓库 workflow 支持在以下配置存在时，`main` 通过 CI 后自动 deploy：

Repository variables:
- `CLOUDFLARE_ACCOUNT_ID`
- `SCORE_KV_NAMESPACE_ID`
- `SCORE_KV_PREVIEW_NAMESPACE_ID`

Repository secret:
- `CLOUDFLARE_API_TOKEN`

Worker runtime secrets 仍应通过 `wrangler secret put` 或 Cloudflare Dashboard 设置，不写入 GitHub Actions 配置。
