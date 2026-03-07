# 完整部署指南

## 第一步：注册免费服务

### 1. PlanetScale（数据库）

1. 访问 https://planetscale.com
2. 使用 GitHub 账号登录
3. 点击 "Create database"
4. 数据库名: `task-reward`
5. 区域选择: `AWS us-east-1` (或离你最近的)
6. 点击 "Create database"

### 2. Cloudflare R2（文件存储）

1. 访问 https://cloudflare.com
2. 注册账号
3. 进入 R2 页面
4. 创建存储桶: `task-reward`
5. 设置为公开访问
6. 生成 API Token:
   - 进入 "Manage R2 API Tokens"
   - 创建新 Token
   - 权限选择: Read & Write
   - 保存 Access Key ID 和 Secret Access Key

### 3. Vercel（后端部署）

1. 访问 https://vercel.com
2. 使用 GitHub 账号登录
3. 准备好后续部署

---

## 第二步：配置数据库

### 1. 获取数据库连接信息

在 PlanetScale 控制台：
1. 点击你的数据库
2. 点击 "Connect"
3. 选择 "Node.js"
4. 复制连接信息：
   ```
   host: xxx.psdb.cloud
   username: xxx
   password: xxx
   ```

### 2. 执行初始化脚本

方法一：使用 PlanetScale CLI
```bash
# 安装 CLI
brew install planetscale/tap/pscale

# 登录
pscale auth login

# 连接数据库
pscale shell task-reward main

# 执行脚本（复制 database/init.sql 内容粘贴执行）
```

方法二：使用在线控制台
1. 在 PlanetScale 控制台点击 "Console"
2. 复制 `database/init.sql` 的内容
3. 粘贴并执行

---

## 第三步：配置 Cloudflare R2

### 1. 获取公开访问 URL

1. 在 R2 控制台选择你的存储桶
2. 点击 "Settings"
3. 找到 "Public URL" 或配置自定义域名
4. 记录下 URL: `https://pub-xxxxx.r2.dev`

### 2. 配置 CORS（重要）

在 R2 存储桶设置中添加 CORS 规则：
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }
]
```

---

## 第四步：部署后端到 Vercel

### 1. 准备代码

```bash
cd task-reward-backend

# 安装依赖
npm install

# 安装 Vercel CLI
npm i -g vercel
```

### 2. 部署

```bash
# 登录 Vercel
vercel login

# 首次部署
vercel

# 按提示操作：
# - Set up and deploy? Yes
# - Which scope? 选择你的账号
# - Link to existing project? No
# - Project name? task-reward-backend
# - Directory? ./
# - Override settings? No
```

### 3. 配置环境变量

部署成功后，在 Vercel 控制台：

1. 进入项目设置 (Settings)
2. 点击 "Environment Variables"
3. 添加以下变量：

```
DB_HOST=你的PlanetScale主机
DB_USERNAME=你的PlanetScale用户名
DB_PASSWORD=你的PlanetScale密码
DB_NAME=task_reward

JWT_SECRET=随机生成一个32位字符串

WECHAT_APPID=你的微信小程序AppID
WECHAT_SECRET=你的微信小程序Secret

R2_ENDPOINT=https://你的账号ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=你的R2 Access Key ID
R2_SECRET_ACCESS_KEY=你的R2 Secret Access Key
R2_BUCKET=task-reward
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev

CRYPTO_KEY=12345678901234567890123456789012
CRYPTO_IV=1234567890123456
```

4. 保存后重新部署：
```bash
vercel --prod
```

### 4. 获取 API 地址

部署成功后，你会得到一个地址，例如：
```
https://task-reward-backend.vercel.app
```

这就是你的后端 API 地址。

---

## 第五步：配置小程序

### 1. 修改 API 地址

在小程序项目中修改：

`utils/request.js`:
```javascript
const BASE_URL = 'https://task-reward-backend.vercel.app/api'
```

`utils/upload.js`:
```javascript
const UPLOAD_URL = 'https://task-reward-backend.vercel.app/api/upload'
```

### 2. 配置服务器域名

在微信小程序后台：
1. 进入 "开发" -> "开发管理" -> "开发设置"
2. 找到 "服务器域名"
3. 添加以下域名：

**request合法域名**:
```
https://task-reward-backend.vercel.app
```

**uploadFile合法域名**:
```
https://task-reward-backend.vercel.app
https://pub-xxxxx.r2.dev
```

**downloadFile合法域名**:
```
https://pub-xxxxx.r2.dev
```

---

## 第六步：测试

### 1. 测试后端 API

```bash
# 测试任务列表
curl https://task-reward-backend.vercel.app/api/tasks

# 测试商家登录
curl -X POST https://task-reward-backend.vercel.app/api/merchant/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. 测试小程序

1. 打开微信开发者工具
2. 导入小程序项目
3. 测试登录功能
4. 测试任务列表
5. 测试图片上传

---

## 常见问题

### 1. 数据库连接失败

检查：
- PlanetScale 数据库是否在运行状态
- 环境变量是否正确配置
- 是否启用了 SSL 连接

### 2. 图片上传失败

检查：
- R2 存储桶是否设置为公开
- CORS 配置是否正确
- R2 API Token 权限是否足够

### 3. 微信登录失败

检查：
- WECHAT_APPID 和 WECHAT_SECRET 是否正确
- 小程序是否已发布或在体验版
- code 是否已过期（5分钟有效期）

### 4. Vercel 部署失败

检查：
- package.json 依赖是否完整
- vercel.json 配置是否正确
- 环境变量是否都已配置

---

## 性能优化建议

### 1. 数据库优化

- 为常用查询添加索引
- 使用连接池
- 定期清理过期数据

### 2. 图片优化

- 上传前压缩图片
- 使用 WebP 格式
- 配置 CDN 加速

### 3. API 优化

- 添加响应缓存
- 使用分页查询
- 减少数据库查询次数

---

## 监控和维护

### 1. Vercel 监控

在 Vercel 控制台查看：
- 函数调用次数
- 响应时间
- 错误日志

### 2. PlanetScale 监控

在 PlanetScale 控制台查看：
- 数据库大小
- 查询性能
- 连接数

### 3. 日志查看

```bash
# 查看 Vercel 实时日志
vercel logs
```

---

## 成本预估

### 免费额度

- Vercel: 100GB 流量/月
- PlanetScale: 10GB 存储 + 10亿行读取/月
- Cloudflare R2: 10GB 存储 + 无限流量

### 超出后费用

- Vercel Pro: $20/月（无限流量）
- PlanetScale Scaler: $29/月（100GB存储）
- R2: $0.015/GB/月

### 预估使用量

日活 1000 用户：
- 每日 API 请求: ~50,000 次
- 每日图片上传: ~1,000 张（~500MB）
- 月流量: ~15GB
- 月存储增长: ~15GB

**结论**: 完全在免费额度内！

---

## 下一步

1. 开发商家端管理后台（Vue 3 + Element Plus）
2. 添加数据统计和报表
3. 实现提现功能
4. 添加消息通知
5. 优化用户体验

需要帮助？查看完整文档或提交 Issue。
