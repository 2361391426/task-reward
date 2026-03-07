# 任务返现平台后端 API

基于 Vercel Serverless 的免费部署方案。

## 技术栈

- Node.js
- Vercel Serverless Functions
- MySQL (PlanetScale)
- Cloudflare R2 (对象存储)
- JWT 认证

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

需要配置的服务：

#### PlanetScale 数据库
1. 注册 https://planetscale.com
2. 创建数据库
3. 获取连接信息填入 `.env`

#### Cloudflare R2 存储
1. 注册 https://cloudflare.com
2. 创建 R2 存储桶
3. 生成 API 密钥填入 `.env`

#### 微信小程序
1. 在微信公众平台获取 AppID 和 Secret
2. 填入 `.env`

### 3. 初始化数据库

连接到 PlanetScale 数据库，执行 `database/init.sql` 脚本：

```bash
# 使用 PlanetScale CLI
pscale shell task-reward main < database/init.sql

# 或在 PlanetScale 控制台执行
```

### 4. 本地开发

```bash
npm run dev
```

访问 http://localhost:3000

### 5. 部署到 Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 生产部署
npm run deploy
```

部署后在 Vercel 控制台配置环境变量。

## API 文档

### 用户端 API

#### 登录
```
POST /api/user/login
Body: { "code": "微信登录code" }
```

#### 获取用户信息
```
GET /api/user/info
Headers: Authorization: Bearer {token}
```

#### 获取收益信息
```
GET /api/user/earnings
Headers: Authorization: Bearer {token}
```

#### 获取任务列表
```
GET /api/tasks?page=1&page_size=10&status=1
```

#### 获取任务详情
```
GET /api/tasks/[id]?id=1
```

#### 提交任务
```
POST /api/submissions
Headers: Authorization: Bearer {token}
Body: {
  "task_id": 1,
  "phone_number": "13800138000",
  "screenshot_search": "https://...",
  "screenshot_shop_1": "https://...",
  "screenshot_shop_2": "https://...",
  "screenshot_shop_3": "https://...",
  "screenshot_follow": "https://...",
  "screenshot_share": "https://...",
  "screenshot_detail": "https://...",
  "screenshot_cart": "https://..."
}
```

#### 获取我的提交记录
```
GET /api/submissions/my?page=1&page_size=20&status=0
Headers: Authorization: Bearer {token}
```

#### 上传图片
```
POST /api/upload
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data
Body: file=<binary>
```

### 商家端 API

#### 商家登录
```
POST /api/merchant/login
Body: { "username": "admin", "password": "admin123" }
```

#### 获取任务列表
```
GET /api/merchant/tasks?page=1&page_size=10&status=1
Headers: Authorization: Bearer {token}
```

#### 创建任务
```
POST /api/merchant/tasks
Headers: Authorization: Bearer {token}
Body: {
  "title": "任务标题",
  "description": "任务描述",
  "reward_amount": 5.00,
  "total_quota": 100,
  "search_keyword": "关键词",
  "shop_name": "店铺名",
  "product_link": "https://...",
  "requirements": {},
  "start_time": "2024-03-06 00:00:00",
  "end_time": "2024-03-10 23:59:59"
}
```

#### 获取提交列表
```
GET /api/merchant/submissions?task_id=1&page=1&page_size=20&status=0
Headers: Authorization: Bearer {token}
```

#### 审核提交
```
POST /api/merchant/submissions/review?id=123
Headers: Authorization: Bearer {token}
Body: {
  "status": 1,
  "reject_reason": "拒绝原因"
}
```

## 项目结构

```
task-reward-backend/
├── api/                          # API 路由
│   ├── user/                     # 用户端 API
│   │   ├── login.js             # 登录
│   │   ├── info.js              # 用户信息
│   │   └── earnings.js          # 收益信息
│   ├── tasks/                    # 任务 API
│   │   ├── index.js             # 任务列表
│   │   └── [id].js              # 任务详情
│   ├── submissions/              # 提交 API
│   │   ├── index.js             # 提交任务
│   │   └── my.js                # 我的提交
│   ├── merchant/                 # 商家端 API
│   │   ├── login.js             # 商家登录
│   │   ├── tasks/
│   │   │   └── index.js         # 任务管理
│   │   └── submissions/
│   │       ├── index.js         # 提交列表
│   │       └── review.js        # 审核
│   └── upload.js                 # 文件上传
├── lib/                          # 核心库
│   ├── db.js                    # 数据库连接
│   ├── auth.js                  # 认证中间件
│   ├── crypto.js                # 加密工具
│   ├── response.js              # 响应格式
│   └── storage.js               # 文件存储
├── database/                     # 数据库脚本
│   └── init.sql                 # 初始化脚本
├── .env.example                  # 环境变量模板
├── vercel.json                   # Vercel 配置
├── package.json
└── README.md
```

## 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| DB_HOST | 数据库主机 | xxx.psdb.cloud |
| DB_USERNAME | 数据库用户名 | xxx |
| DB_PASSWORD | 数据库密码 | xxx |
| DB_NAME | 数据库名 | task_reward |
| JWT_SECRET | JWT密钥 | your-secret-key |
| WECHAT_APPID | 微信小程序AppID | wx... |
| WECHAT_SECRET | 微信小程序Secret | xxx |
| R2_ENDPOINT | R2端点 | https://xxx.r2.cloudflarestorage.com |
| R2_ACCESS_KEY_ID | R2访问密钥ID | xxx |
| R2_SECRET_ACCESS_KEY | R2访问密钥 | xxx |
| R2_BUCKET | R2存储桶名 | task-reward |
| R2_PUBLIC_URL | R2公开URL | https://pub-xxx.r2.dev |
| CRYPTO_KEY | 加密密钥(32字节) | xxx |
| CRYPTO_IV | 加密IV(16字节) | xxx |

## 测试账号

### 商家账号
- 用户名: admin
- 密码: admin123

## 注意事项

1. **数据库连接**: PlanetScale 需要 SSL 连接
2. **文件上传**: 单个文件最大 5MB
3. **JWT过期时间**: 用户端7天，商家端24小时
4. **手机号加密**: 使用 AES-256-CBC 加密存储
5. **CORS**: 已配置允许所有来源，生产环境建议限制

## 成本说明

完全免费方案：
- Vercel: 免费（100GB流量/月）
- PlanetScale: 免费（10GB存储）
- Cloudflare R2: 免费（10GB存储）

适合日活 1000 以内的小规模应用。

## 扩展建议

当业务增长后可以考虑：
1. 升级 Vercel Pro ($20/月)
2. 升级 PlanetScale Scaler ($29/月)
3. 添加 Redis 缓存
4. 使用 CDN 加速
5. 添加监控告警

## License

MIT
