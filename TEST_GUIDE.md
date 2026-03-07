# 本地测试指南

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd task-reward-backend
npm install

# 安装商家端依赖
cd ../merchant-admin
npm install

# 安装小程序依赖（可选）
cd ..
npm install
```

### 2. 启动后端测试服务器

```bash
cd task-reward-backend
npm run test
```

服务器将运行在 `http://localhost:3001`

### 3. 启动商家端管理后台

```bash
cd merchant-admin
npm run dev
```

管理后台将运行在 `http://localhost:3000`

默认账号：
- 用户名: `admin`
- 密码: `admin123`

## API 测试

### 健康检查
```bash
curl http://localhost:3001/api/health
```

### 商家登录
```bash
curl -X POST http://localhost:3001/api/merchant/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 创建任务
```bash
curl -X POST http://localhost:3001/api/merchant/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "测试任务",
    "search_keyword": "测试关键词",
    "shop_name": "测试店铺",
    "product_name": "测试商品",
    "reward_amount": 10.00,
    "total_quota": 100,
    "end_time": "2024-12-31 23:59:59"
  }'
```

### 获取任务列表
```bash
curl http://localhost:3001/api/tasks
```

### 用户登录（模拟微信登录）
```bash
curl -X POST http://localhost:3001/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code_123"}'
```

## 测试流程

### 1. 商家端测试

1. 访问 http://localhost:3000
2. 使用 admin/admin123 登录
3. 查看数据概览
4. 创建一个测试任务
5. 查看任务列表

### 2. 用户端测试（使用 Postman 或 curl）

1. 调用登录接口获取 token
2. 获取任务列表
3. 获取任务详情
4. 上传图片（8张）
5. 提交任务
6. 查看提交记录

### 3. 审核测试

1. 在商家端查看提交列表
2. 点击查看详情，查看8张截图
3. 审核通过或驳回
4. 检查用户余额是否更新

## 数据库

本地测试使用 SQLite 数据库，文件位置：
```
task-reward-backend/test.db
```

可以使用 SQLite 客户端查看数据：
```bash
sqlite3 task-reward-backend/test.db
```

常用 SQL 命令：
```sql
-- 查看所有表
.tables

-- 查看用户
SELECT * FROM users;

-- 查看商家
SELECT * FROM merchants;

-- 查看任务
SELECT * FROM tasks;

-- 查看提交记录
SELECT * FROM submissions;

-- 查看收益记录
SELECT * FROM earnings;
```

## 文件上传

上传的文件保存在：
```
task-reward-backend/uploads/
```

访问地址：
```
http://localhost:3001/uploads/文件名
```

## 小程序配置

修改小程序的 API 地址：

**utils/request.js**:
```javascript
const BASE_URL = 'http://localhost:3001/api'
```

**utils/upload.js**:
```javascript
const UPLOAD_URL = 'http://localhost:3001/api/upload'
```

然后在微信开发者工具中运行：
```bash
npm run dev:mp-weixin
```

## 常见问题

### 1. 端口被占用
如果 3001 端口被占用，修改 `server-local.js` 中的 PORT 变量

### 2. SQLite 安装失败
Windows 用户可能需要安装 Visual Studio Build Tools

### 3. 图片上传失败
检查 uploads 目录是否有写入权限

### 4. CORS 错误
已配置 CORS，如果还有问题，检查请求头

## 下一步

测试通过后，可以：

1. 部署后端到 Vercel
2. 配置真实的数据库（PlanetScale）
3. 配置文件存储（Cloudflare R2）
4. 配置微信小程序
5. 发布小程序和商家端

详见 `QUICK_START.md`
