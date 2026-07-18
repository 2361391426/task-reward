# 小程序生产 API 代理

该 Worker 将小程序请求转发到 Vercel 后端，用于给自有域名提供代理入口。

`*.workers.dev` 默认域名在部分中国大陆网络中同样可能无法直连，不应直接作为小程序正式生产域名。正式上线前需要绑定可稳定访问的自有域名，或迁移到国内云服务。

```powershell
npx wrangler login
npx wrangler deploy --config cloudflare-worker/wrangler.toml
```

部署后将 Worker 地址加入微信小程序的 `request` 和 `uploadFile` 合法域名，然后将根目录 `.env.production` 中的 API 地址指向 Worker 的 `/api` 路径。
