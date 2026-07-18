# Task Reward 后端

这是任务返现平台的后端服务，支持：

- Vercel Serverless 部署
- Neon Postgres 数据库
- Cloudflare R2 文件存储
- 微信登录、用户信息、任务、提交、审核、提现、反馈

## 快速开始

### 1. 安装依赖

```bash
cd task-reward-backend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，然后填写：

- `DATABASE_URL`
- `JWT_SECRET`
- `WECHAT_APPID`
- `WECHAT_SECRET` 或 `WECHAT_APPSECRET`
- `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_PUBLIC_URL`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CRYPTO_KEY`
- `CRYPTO_IV`

### 3. 初始化数据库

如果使用 Neon，执行：

```bash
psql "$DATABASE_URL" -f database/init-postgres.sql
```

或者把 `database/init-postgres.sql` 的内容粘贴到 Neon 控制台执行。

### 4. 本地启动

```bash
npm run start:local
```

### 5. 部署到 Vercel

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

部署后在 Vercel 控制台继续配置环境变量，确保至少有：

- `DATABASE_URL`
- `JWT_SECRET`
- `WECHAT_APPID`
- `WECHAT_SECRET`
- `R2_*`
- `CRYPTO_KEY`
- `CRYPTO_IV`

## 数据库说明

### Neon 推荐方式

生产环境优先使用 Neon：

```env
DATABASE_URL=postgresql://username:password@host.neon.tech/task_reward?sslmode=require
```

### 兼容方式

保留了旧的 MySQL 兼容配置，方便本地迁移或临时切换：

```env
DB_HOST=...
DB_USERNAME=...
DB_PASSWORD=...
DB_NAME=...
```

## 常用脚本

```bash
npm run check       # 检查生产配置
npm run start:local # 本地启动
npm run migrate     # 初始化/迁移数据库
npm run smoke       # 冒烟测试
npm run test:p2     # P2 回归测试
```

## 数据库初始化

Postgres 初始化脚本：

- `database/init-postgres.sql`

MySQL 兼容初始化脚本：

- `database/init.sql`

## 常见问题

### 1. 数据库连不上

- 检查 `DATABASE_URL` 是否正确
- Neon 连接串是否包含 `sslmode=require`
- Vercel 环境变量是否已保存并重新部署

### 2. 图片上传失败

- 检查 `R2_ENDPOINT`、`R2_BUCKET`、`R2_PUBLIC_URL`
- 检查 R2 API Key 是否有读写权限

### 3. 微信登录失败

- 检查 `WECHAT_APPID` 和 `WECHAT_SECRET`
- 小程序是否已配置合法请求域名

