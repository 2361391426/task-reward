# 免费/低成本部署方案

## 方案概述

完全免费的云服务组合，适合初期开发和小规模运营。

---

## 推荐架构

```
用户端小程序 → 免费后端服务 → 免费数据库 → 免费对象存储
```

---

## 1. 后端部署方案（三选一）

### 方案A：Vercel + Serverless（推荐）⭐

**优势：**
- 完全免费
- 自动部署
- 全球CDN加速
- 支持Node.js
- 无需服务器管理

**限制：**
- 单个函数执行时间10秒
- 每月100GB流量
- 适合轻量级应用

**技术栈：**
```
- 框架: Next.js API Routes / Express
- 部署: Vercel
- 数据库: PlanetScale (免费MySQL)
- 存储: Cloudflare R2 (免费10GB)
```

**部署步骤：**
```bash
# 1. 安装Vercel CLI
npm i -g vercel

# 2. 项目结构
task-reward-api/
├── api/
│   ├── user/
│   │   ├── login.js
│   │   └── info.js
│   ├── tasks/
│   │   ├── index.js
│   │   └── [id].js
│   ├── submissions/
│   │   ├── index.js
│   │   └── my.js
│   └── upload.js
├── lib/
│   ├── db.js
│   ├── auth.js
│   └── utils.js
├── package.json
└── vercel.json

# 3. vercel.json 配置
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "env": {
    "DATABASE_URL": "@database_url",
    "JWT_SECRET": "@jwt_secret"
  }
}

# 4. 部署
vercel --prod
```

---

### 方案B：Railway（推荐新手）⭐⭐

**优势：**
- 每月500小时免费（约20天）
- 支持MySQL、Redis
- 自动部署
- 简单易用

**限制：**
- 需要绑定信用卡（不扣费）
- 超出免费额度后按量计费

**部署步骤：**
```bash
# 1. 访问 railway.app
# 2. 连接GitHub仓库
# 3. 自动部署
# 4. 添加MySQL插件
# 5. 配置环境变量
```

---

### 方案C：Render（稳定可靠）⭐

**优势：**
- 完全免费
- 支持Node.js、Python等
- 自动SSL证书
- 自动部署

**限制：**
- 15分钟无请求会休眠
- 冷启动需要30秒
- 每月750小时

**部署步骤：**
```bash
# 1. 访问 render.com
# 2. 连接GitHub
# 3. 选择Web Service
# 4. 配置构建命令: npm install
# 5. 配置启动命令: npm start
```

---

## 2. 数据库方案（三选一）

### 方案A：PlanetScale（推荐）⭐⭐⭐

**优势：**
- 完全免费
- MySQL兼容
- 10GB存储
- 10亿行读取/月
- 1000万行写入/月
- 自动备份

**注册：** https://planetscale.com

**连接方式：**
```javascript
// lib/db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: true
  }
});

module.exports = pool;
```

---

### 方案B：Supabase（功能丰富）⭐⭐

**优势：**
- 完全免费
- PostgreSQL
- 500MB数据库
- 1GB文件存储
- 自带认证系统
- 实时数据库

**注册：** https://supabase.com

---

### 方案C：MongoDB Atlas（NoSQL）⭐

**优势：**
- 512MB免费存储
- 适合文档型数据
- 自动扩展

**注册：** https://www.mongodb.com/cloud/atlas

---

## 3. 文件存储方案（三选一）

### 方案A：Cloudflare R2（推荐）⭐⭐⭐

**优势：**
- 完全免费
- 10GB存储
- 无流量费用
- S3兼容API

**注册：** https://cloudflare.com

**配置：**
```javascript
// lib/storage.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

async function uploadFile(file, filename) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: filename,
    Body: file.buffer,
    ContentType: file.mimetype
  });

  await s3Client.send(command);
  return `${process.env.R2_PUBLIC_URL}/${filename}`;
}
```

---

### 方案B：Vercel Blob（简单）⭐⭐

**优势：**
- 与Vercel集成
- 1GB免费存储
- 简单易用

**使用：**
```javascript
import { put } from '@vercel/blob';

const blob = await put('avatar.png', file, {
  access: 'public',
});
```

---

### 方案C：Supabase Storage（集成）⭐

**优势：**
- 1GB免费存储
- 与Supabase数据库集成
- 自动图片优化

---

## 4. 完整免费方案组合

### 推荐组合1：极简方案（最省钱）💰

```
后端: Vercel Serverless
数据库: PlanetScale (MySQL)
存储: Cloudflare R2
域名: Freenom (免费域名) 或 自己的域名

总成本: 0元/月
```

**适合场景：**
- 初期开发测试
- 日活1000以内
- 图片上传量小

---

### 推荐组合2：稳定方案（推荐）⭐

```
后端: Railway
数据库: Railway MySQL
存储: Cloudflare R2
域名: 自己的域名

总成本: 0-5美元/月（超出免费额度）
```

**适合场景：**
- 正式运营
- 日活5000以内
- 需要Redis缓存

---

### 推荐组合3：全功能方案

```
后端: Render
数据库: Supabase PostgreSQL
存储: Supabase Storage
认证: Supabase Auth

总成本: 0元/月
```

**适合场景：**
- 需要实时功能
- 需要完整的后台管理
- 快速开发

---

## 5. 具体实施步骤（推荐组合1）

### 第一步：注册账号

1. **Vercel**: https://vercel.com
   - 使用GitHub登录

2. **PlanetScale**: https://planetscale.com
   - 创建免费数据库

3. **Cloudflare**: https://cloudflare.com
   - 创建R2存储桶

---

### 第二步：创建数据库

```bash
# 1. 在PlanetScale创建数据库
# 2. 获取连接字符串
# 3. 执行SQL创建表（使用之前的数据库设计）

# 连接数据库
pscale connect task-reward main

# 或使用在线控制台执行SQL
```

---

### 第三步：配置后端项目

```bash
# 1. 创建项目
mkdir task-reward-api
cd task-reward-api
npm init -y

# 2. 安装依赖
npm install mysql2 jsonwebtoken bcrypt axios @aws-sdk/client-s3

# 3. 创建API文件
mkdir -p api/user api/tasks api/submissions

# 4. 创建 api/user/login.js
```

**api/user/login.js 示例：**
```javascript
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// 数据库连接
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true }
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 405, message: 'Method not allowed' });
  }

  try {
    const { code } = req.body;

    // 1. 微信登录
    const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    if (data.errcode) {
      return res.status(400).json({ code: 1001, message: data.errmsg });
    }

    const { openid } = data;

    // 2. 查找或创建用户
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    );

    let user;
    if (rows.length === 0) {
      const [result] = await pool.query(
        'INSERT INTO users (openid) VALUES (?)',
        [openid]
      );
      user = { id: result.insertId, openid };
    } else {
      user = rows[0];
    }

    // 3. 生成token
    const token = jwt.sign(
      { user_id: user.id, type: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      code: 0,
      data: {
        token,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          total_earnings: user.total_earnings || 0,
          available_balance: user.available_balance || 0
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: 500, message: '服务器错误' });
  }
}
```

---

### 第四步：部署到Vercel

```bash
# 1. 安装Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel

# 4. 配置环境变量（在Vercel控制台）
DB_HOST=xxx.psdb.cloud
DB_USERNAME=xxx
DB_PASSWORD=xxx
DB_NAME=task-reward
JWT_SECRET=your_secret_key
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=task-reward
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# 5. 生产部署
vercel --prod
```

---

### 第五步：配置小程序

修改小程序的 `utils/request.js`：
```javascript
const BASE_URL = 'https://your-project.vercel.app/api'
```

修改 `utils/upload.js`：
```javascript
const UPLOAD_URL = 'https://your-project.vercel.app/api/upload'
```

---

## 6. 成本对比

| 方案 | 月成本 | 适合规模 | 优势 |
|------|--------|----------|------|
| Vercel + PlanetScale | 0元 | 日活<1000 | 完全免费，自动扩展 |
| Railway | 0-5美元 | 日活<5000 | 稳定可靠，支持Redis |
| Render + Supabase | 0元 | 日活<3000 | 功能丰富，实时数据库 |
| 传统VPS | 5-20美元 | 不限 | 完全控制，性能稳定 |

---

## 7. 扩展方案（业务增长后）

### 当用户量增长到5000+日活时：

**方案1：升级到付费套餐**
- Vercel Pro: $20/月
- PlanetScale Scaler: $29/月
- 总计: $49/月

**方案2：迁移到云服务器**
- 腾讯云轻量应用服务器: ¥50/月
- 阿里云ECS: ¥60/月
- 自建MySQL + Redis

**方案3：使用国内Serverless**
- 腾讯云云函数 + 云数据库
- 阿里云函数计算 + RDS
- 按量计费，约¥100-300/月

---

## 8. 注意事项

### Vercel限制
- 单个函数最大50MB
- 执行时间最长10秒（Hobby）/ 60秒（Pro）
- 不适合长时间运行的任务

### 解决方案
- 图片处理使用异步队列
- 大文件上传直传OSS
- 定时任务使用GitHub Actions

### 微信小程序要求
- 必须配置合法域名（需要备案）
- 如果使用Vercel，域名自动支持HTTPS
- 需要在小程序后台配置服务器域名白名单

---

## 9. 快速开始模板

我可以为你创建一个完整的项目模板，包含：

1. **后端API**（Vercel Serverless）
   - 用户登录
   - 任务管理
   - 提交审核
   - 文件上传

2. **数据库脚本**（PlanetScale）
   - 建表SQL
   - 初始数据

3. **部署配置**
   - vercel.json
   - 环境变量模板
   - 部署文档

需要我创建这个模板吗？
