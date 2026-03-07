# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个完整的任务返现平台，包含：
- **用户端小程序**（uni-app + Vue 3）：用户接取任务、上传截图、获得返现
- **后端 API**（Node.js + Vercel Serverless）：处理业务逻辑、数据存储
- **商家端管理后台**（Vue 3 + Element Plus）：商家发布任务、审核提交

## 项目结构

```
task-reward-miniapp/          # 小程序前端
├── pages/                    # 页面
├── api/                      # API 接口调用
├── utils/                    # 工具函数
└── components/               # 组件

task-reward-backend/          # 后端 API
├── api/                      # Serverless 函数
│   ├── user/                # 用户端 API
│   ├── tasks/               # 任务 API
│   ├── submissions/         # 提交 API
│   ├── merchant/            # 商家端 API
│   └── upload.js            # 文件上传
├── lib/                      # 核心库
│   ├── db.js               # 数据库
│   ├── auth.js             # 认证
│   ├── crypto.js           # 加密
│   ├── response.js         # 响应格式
│   └── storage.js          # 文件存储
└── database/                 # 数据库脚本

docs/                         # 设计文档
├── DATABASE_DESIGN.md       # 数据库设计
├── API_DOCUMENTATION.md     # API 文档
├── MERCHANT_DESIGN.md       # 商家端设计
├── BACKEND_IMPLEMENTATION.md # 后端实现
└── FREE_DEPLOYMENT.md       # 免费部署方案
```

## 开发命令

### 小程序开发
```bash
cd task-reward-miniapp
npm install
npm run dev:mp-weixin
```

### 后端开发
```bash
cd task-reward-backend
npm install
npm run dev              # 本地开发
npm run deploy           # 部署到 Vercel
```

## 核心架构

### 小程序端

#### API 层设计
- **统一请求封装**: `utils/request.js` 提供了统一的 HTTP 请求封装，自动处理 token 认证、错误提示和响应格式化
- **API 模块化**:
  - `api/task.js` - 任务相关接口（列表、详情、提交、记录）
  - `api/user.js` - 用户相关接口（登录、信息）
- **响应格式约定**: 后端统一返回 `{ code: 0, data: {}, message: '' }` 格式，code 为 0 表示成功

#### 图片上传机制
`utils/upload.js` 提供两个核心方法：
- `uploadImage(filePath)` - 上传单张图片，返回图片 URL
- `chooseAndUploadImage(count)` - 选择并批量上传图片

上传时自动携带 token，使用 `uni.uploadFile` API，图片会被压缩处理。

#### 任务提交流程
任务提交需要8张截图，按固定顺序：
1. 搜索关键词截图（1张）
2. 浏览其他店铺截图（3张）
3. 主图点关注评论截图（1张）
4. 分享截图（1张）
5. 商品详情页浏览截图（1张）
6. 商品加购截图（1张）

提交数据结构见 `api/task.js` 中的 `submitTask` 方法，字段名为 `screenshot_search`, `screenshot_shop_1/2/3`, `screenshot_follow`, `screenshot_share`, `screenshot_detail`, `screenshot_cart`。

#### 页面路由结构
- `pages/index` - 任务列表页（首页，tabBar）
- `pages/task-detail` - 任务详情页（通过 task_id 参数跳转）
- `pages/upload` - 图片上传页（分步骤上传8张截图）
- `pages/my` - 我的页面（收益统计、提交记录，tabBar）

### 后端架构

#### 技术栈
- **运行环境**: Vercel Serverless Functions
- **数据库**: PlanetScale MySQL（免费 10GB）
- **文件存储**: Cloudflare R2（免费 10GB）
- **认证**: JWT Token
- **加密**: AES-256-CBC（手机号）、bcrypt（密码）

#### 核心模块
- `lib/db.js` - 数据库连接池、查询封装、事务支持
- `lib/auth.js` - JWT 生成/验证、用户/商家认证中间件
- `lib/crypto.js` - 加密/解密、手机号脱敏
- `lib/response.js` - 统一响应格式、错误码定义
- `lib/storage.js` - Cloudflare R2 文件上传

#### API 路由
**用户端**:
- `POST /api/user/login` - 微信登录
- `GET /api/user/info` - 获取用户信息
- `GET /api/user/earnings` - 获取收益信息
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/[id]` - 获取任务详情
- `POST /api/submissions` - 提交任务
- `GET /api/submissions/my` - 我的提交记录
- `POST /api/upload` - 上传图片

**商家端**:
- `POST /api/merchant/login` - 商家登录
- `GET /api/merchant/tasks` - 获取任务列表
- `POST /api/merchant/tasks` - 创建任务
- `GET /api/merchant/submissions` - 获取提交列表
- `POST /api/merchant/submissions/review` - 审核提交

#### 数据库设计
8张核心表：
- `users` - 用户表（openid、余额、收益）
- `merchants` - 商家表（账号、密码、余额）
- `tasks` - 任务表（标题、奖励、名额、状态）
- `submissions` - 提交记录表（8张截图、审核状态）
- `earnings` - 收益记录表（类型、金额、余额）
- `withdrawals` - 提现记录表
- `merchant_recharges` - 商家充值表
- `system_config` - 系统配置表

关键约束：
- `submissions` 表有唯一索引 `(task_id, user_id)` 防止重复提交
- 所有金额字段使用 `DECIMAL(10,2)` 类型
- 手机号加密存储，使用 `VARCHAR(255)`

#### 业务流程

**提交任务流程**:
1. 验证用户认证（JWT）
2. 检查任务状态和名额
3. 检查是否重复提交
4. 加密手机号
5. 使用事务：创建提交记录 + 减少任务名额
6. 返回提交ID

**审核流程**:
1. 验证商家认证（JWT）
2. 检查提交记录和权限
3. 使用事务：
   - 更新提交状态
   - 如果通过：更新用户余额 + 创建收益记录
   - 如果拒绝：恢复任务名额
4. 返回审核结果

## 配置要点

### 小程序配置

1. **API 地址**: 修改 `utils/request.js` 中的 `BASE_URL` 和 `utils/upload.js` 中的 `UPLOAD_URL`
2. **微信小程序 AppID**: 修改 `manifest.json` 中的 `mp-weixin.appid`
3. **服务器域名白名单**: 在微信小程序后台配置 request 和 uploadFile 合法域名

### 后端配置

必须配置的环境变量（在 Vercel 控制台）：
```
DB_HOST=xxx.psdb.cloud
DB_USERNAME=xxx
DB_PASSWORD=xxx
DB_NAME=task_reward
JWT_SECRET=随机32位字符串
WECHAT_APPID=wx...
WECHAT_SECRET=xxx
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=task-reward
R2_PUBLIC_URL=https://pub-xxx.r2.dev
CRYPTO_KEY=32字节加密密钥
CRYPTO_IV=16字节加密IV
```

### Token 管理
- 用户端 Token 有效期：7天
- 商家端 Token 有效期：24小时
- Token 存储在小程序 `uni.getStorageSync('token')` 中
- 所有需要认证的 API 请求自动携带 `Authorization: Bearer {token}` header

## 部署流程

### 快速部署（15分钟）

1. **注册服务**（5分钟）
   - PlanetScale: https://planetscale.com
   - Cloudflare: https://cloudflare.com
   - Vercel: https://vercel.com

2. **初始化数据库**（2分钟）
   - 在 PlanetScale 控制台执行 `task-reward-backend/database/init.sql`

3. **部署后端**（3分钟）
   ```bash
   cd task-reward-backend
   npm install
   vercel --prod
   ```

4. **配置环境变量**（3分钟）
   - 在 Vercel 控制台添加所有环境变量

5. **配置小程序**（2分钟）
   - 修改 API 地址
   - 配置服务器域名白名单

详细步骤见 `QUICK_START.md`

## 安全特性

1. **认证**: JWT Token 认证，用户端和商家端分离
2. **加密**: 手机号 AES-256 加密存储，商家密码 bcrypt 加密
3. **防刷**: 唯一索引防止重复提交，可扩展 IP 限制和设备指纹
4. **SQL 注入防护**: 使用参数化查询
5. **文件上传**: 类型验证、大小限制（5MB）
6. **CORS**: 已配置，生产环境建议限制来源

## 成本说明

### 完全免费方案
- Vercel: 免费（100GB 流量/月）
- PlanetScale: 免费（10GB 存储）
- Cloudflare R2: 免费（10GB 存储）
- **总成本**: 0元/月
- **适合规模**: 日活 1000 以内

### 扩展方案
当业务增长后：
- Vercel Pro: $20/月
- PlanetScale Scaler: $29/月
- 总计约 $49/月，支持日活 5000+

## 测试账号

### 商家账号
- 用户名: `admin`
- 密码: `admin123`

## 常见问题

### 数据库连接失败
- 检查环境变量是否正确配置
- 确认 PlanetScale 数据库状态为 active
- 确认 SSL 连接已启用

### 图片上传失败
- 检查 R2 CORS 配置
- 确认 R2 API Token 权限为 Read & Write
- 检查文件大小是否超过 5MB

### 微信登录失败
- 检查 WECHAT_APPID 和 WECHAT_SECRET 是否正确
- 确认小程序已发布或在体验版
- 检查 code 是否已过期（5分钟有效期）

## 相关文档

- [快速启动指南](QUICK_START.md) - 15分钟快速部署
- [项目总结](PROJECT_SUMMARY.md) - 完整功能清单
- [数据库设计](docs/DATABASE_DESIGN.md) - 详细表结构
- [API 文档](docs/API_DOCUMENTATION.md) - 完整接口说明
- [商家端设计](docs/MERCHANT_DESIGN.md) - 管理后台设计
- [后端实现](docs/BACKEND_IMPLEMENTATION.md) - 技术实现细节
- [免费部署方案](docs/FREE_DEPLOYMENT.md) - 免费服务对比
- [部署指南](task-reward-backend/DEPLOYMENT.md) - 详细部署步骤

## 注意事项

- 图片上传使用 `sizeType: ['compressed']` 自动压缩
- 手机号字段需要后端加密存储
- 所有用户操作失败时会自动显示 toast 提示
- 页面配置在 `pages.json` 中，包括导航栏和 tabBar 设置
- Vercel Serverless 函数执行时间限制 10 秒（Hobby）/ 60 秒（Pro）
- 不适合长时间运行的任务，建议使用异步队列处理
