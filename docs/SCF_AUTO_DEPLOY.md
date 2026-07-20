# 腾讯云函数自动部署

以后后端不用再手动上传 zip。推送到 GitHub 后，`GitHub Actions` 会自动构建并发布腾讯云函数。

## 需要配置的 GitHub Secrets

进入仓库：

`Settings -> Secrets and variables -> Actions -> New repository secret`

必须配置：

```env
TENCENT_SECRET_ID=腾讯云 SecretId
TENCENT_SECRET_KEY=腾讯云 SecretKey
DATABASE_URL=Neon 数据库连接串
JWT_SECRET=登录签名密钥
WECHAT_APPID=微信小程序 AppID
WECHAT_SECRET=微信小程序 AppSecret
R2_ENDPOINT=Cloudflare R2 S3 API 地址
R2_BUCKET=R2 存储桶名称
R2_PUBLIC_URL=R2 公网访问地址
R2_ACCESS_KEY_ID=R2 Access Key ID
R2_SECRET_ACCESS_KEY=R2 Secret Access Key
```

建议配置：

```env
TENCENT_REGION=ap-guangzhou
SCF_FUNCTION_NAME=taskreward
SCF_NAMESPACE=default
SCF_HANDLER=scf_bootstrap
ADMIN_USERNAME=admin
ADMIN_PASSWORD=你的管理员密码
ADMIN_DISPLAY_NAME=诺斯马丁
ADMIN_PHONE=13676526221
```

## 自动部署触发方式

满足任意一个条件会自动部署：

1. 推送代码到 `main` 或 `master` 分支，并且改动包含 `task-reward-backend/**`。
2. 在 GitHub Actions 页面手动点击 `Run workflow`。

## 发布后检查

部署完成后访问：

```text
https://1455441725-f1qvv2j2lt.ap-guangzhou.tencentscf.com/api/health
```

正常返回 `status=healthy` 才说明后端已连上数据库。

再检查：

```text
https://1455441725-f1qvv2j2lt.ap-guangzhou.tencentscf.com/api/tasks?page=1&page_size=10
```

能返回任务列表，说明小程序任务大厅可以访问生产接口。
