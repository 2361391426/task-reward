# 后端部署指南

这份指南以 **Neon + Vercel + Cloudflare R2** 为当前推荐方案。

## 1. 准备服务

### Neon 数据库

1. 注册 Neon
2. 创建一个 Postgres 数据库
3. 复制连接串，得到 `DATABASE_URL`
4. 执行 `database/init-postgres.sql`

### Cloudflare R2

1. 创建 R2 Bucket
2. 创建 API Token
3. 记录：
   - `R2_ENDPOINT`
   - `R2_BUCKET`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_PUBLIC_URL`

### 微信小程序

1. 在微信公众平台获取 `AppID`
2. 获取 `AppSecret`

## 2. 本地初始化

```bash
cd task-reward-backend
npm install
npm run check
npm run migrate
```

## 3. 部署到 Vercel

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

部署后到 Vercel 控制台配置环境变量：

```env
DATABASE_URL=postgresql://username:password@host.neon.tech/task_reward?sslmode=require
JWT_SECRET=请填写至少32位随机字符串
WECHAT_APPID=你的微信小程序AppID
WECHAT_SECRET=你的微信小程序Secret
R2_ENDPOINT=https://xxxx.r2.cloudflarestorage.com
R2_BUCKET=task-reward
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
R2_ACCESS_KEY_ID=xxxx
R2_SECRET_ACCESS_KEY=xxxx
CRYPTO_KEY=12345678901234567890123456789012
CRYPTO_IV=1234567890123456
```

## 4. 验证

### 健康检查

访问：

```bash
/api/health
```

返回里会显示：

- `db_mode`
- `database_url_set`
- `jwt_secret_set`

### 常见排错

- 如果部署报函数过多，确认只保留了 `api/[...path].js`
- 如果数据库连接失败，先检查 Neon 连接串是否正确
- 如果图片上传失败，检查 R2 配置和 CORS

## 5. 当前推荐环境

### 生产环境

- Vercel
- Neon Postgres
- Cloudflare R2

### 本地环境

- `npm run start:local`
- 可继续使用旧 MySQL 兼容配置做临时调试

