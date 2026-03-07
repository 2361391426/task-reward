# 🚀 快速启动指南

## 5分钟快速部署

### 前置准备
- GitHub 账号
- 微信小程序账号

---

## 第一步：一键注册所有服务（5分钟）

### 1. PlanetScale（数据库）
```
1. 访问: https://planetscale.com
2. 点击 "Sign up" 用 GitHub 登录
3. 点击 "Create database"
4. 名称: task-reward
5. 区域: AWS us-east-1
6. 点击 "Create"
```

### 2. Cloudflare（存储）
```
1. 访问: https://cloudflare.com
2. 注册账号
3. 左侧菜单找到 "R2"
4. 点击 "Create bucket"
5. 名称: task-reward
6. 点击 "Create bucket"
```

### 3. Vercel（部署）
```
1. 访问: https://vercel.com
2. 用 GitHub 登录
3. 准备好即可
```

---

## 第二步：配置数据库（2分钟）

### 获取连接信息
```
1. 进入 PlanetScale 控制台
2. 点击你的数据库
3. 点击 "Connect"
4. 选择 "Node.js"
5. 复制连接信息保存
```

### 初始化数据库
```
1. 点击 "Console" 标签
2. 打开 task-reward-backend/database/init.sql
3. 复制全部内容
4. 粘贴到 Console 执行
5. 等待执行完成
```

---

## 第三步：配置 R2（2分钟）

### 生成 API Token
```
1. 在 R2 页面点击 "Manage R2 API Tokens"
2. 点击 "Create API Token"
3. 名称: task-reward-api
4. 权限: Admin Read & Write
5. 点击 "Create API Token"
6. 复制 Access Key ID 和 Secret Access Key
```

### 获取公开 URL
```
1. 进入你的存储桶
2. 点击 "Settings"
3. 找到 "Public URL"
4. 复制 URL（格式: https://pub-xxxxx.r2.dev）
```

---

## 第四步：部署后端（3分钟）

### 本地准备
```bash
cd task-reward-backend
npm install
npm i -g vercel
```

### 部署
```bash
vercel login
vercel
```

按提示操作：
- Set up and deploy? **Yes**
- Which scope? **选择你的账号**
- Link to existing project? **No**
- Project name? **task-reward-backend**
- Directory? **./（直接回车）**
- Override settings? **No**

### 配置环境变量

部署成功后，访问 Vercel 控制台：

```
1. 进入项目
2. 点击 "Settings"
3. 点击 "Environment Variables"
4. 添加以下变量（点击 "Add" 按钮）
```

**必填变量**：
```
DB_HOST=你的PlanetScale主机
DB_USERNAME=你的PlanetScale用户名
DB_PASSWORD=你的PlanetScale密码
DB_NAME=task_reward

JWT_SECRET=随机32位字符串（可用：https://randomkeygen.com/）

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

### 重新部署
```bash
vercel --prod
```

记录下你的 API 地址：`https://your-project.vercel.app`

---

## 第五步：配置小程序（2分钟）

### 修改 API 地址

**utils/request.js**:
```javascript
const BASE_URL = 'https://your-project.vercel.app/api'
```

**utils/upload.js**:
```javascript
const UPLOAD_URL = 'https://your-project.vercel.app/api/upload'
```

### 配置服务器域名

在微信小程序后台：
```
1. 开发 -> 开发管理 -> 开发设置
2. 服务器域名
3. 添加以下域名：
```

**request合法域名**:
```
https://your-project.vercel.app
```

**uploadFile合法域名**:
```
https://your-project.vercel.app
https://pub-xxxxx.r2.dev
```

**downloadFile合法域名**:
```
https://pub-xxxxx.r2.dev
```

---

## 第六步：测试（1分钟）

### 测试后端
```bash
# 测试任务列表
curl https://your-project.vercel.app/api/tasks

# 应该返回：
# {"code":0,"message":"success","data":{"total":0,"page":1,"page_size":10,"list":[]}}
```

### 测试小程序
```
1. 打开微信开发者工具
2. 导入小程序项目
3. 点击 "编译"
4. 测试登录功能
```

---

## 🎉 完成！

总用时：约 15 分钟

你现在拥有：
- ✅ 完整的后端 API
- ✅ 免费的数据库
- ✅ 免费的文件存储
- ✅ 自动扩展的部署
- ✅ 全球 CDN 加速

**完全免费，支持日活 1000+ 用户！**

---

## 下一步

### 创建测试任务

1. 使用商家账号登录：
   - 用户名: `admin`
   - 密码: `admin123`

2. 创建一个测试任务

3. 在小程序中测试完整流程

### 开发商家端管理后台

参考 `docs/MERCHANT_DESIGN.md` 开发 Vue 3 管理后台。

---

## 遇到问题？

### 常见问题

**1. 数据库连接失败**
- 检查环境变量是否正确
- 确认 PlanetScale 数据库状态

**2. 图片上传失败**
- 检查 R2 CORS 配置
- 确认 R2 API Token 权限

**3. 微信登录失败**
- 检查 AppID 和 Secret
- 确认小程序已发布或在体验版

### 获取帮助

- 查看完整文档: `task-reward-backend/DEPLOYMENT.md`
- 查看 API 文档: `docs/API_DOCUMENTATION.md`
- 提交 Issue

---

## 成本说明

### 免费额度
- Vercel: 100GB 流量/月
- PlanetScale: 10GB 存储
- Cloudflare R2: 10GB 存储

### 预估使用
日活 1000 用户：
- API 请求: ~50,000 次/天
- 图片上传: ~1,000 张/天
- 月流量: ~15GB
- 月存储: ~15GB

**结论：完全在免费额度内！**

---

## 监控

### Vercel 控制台
- 查看函数调用次数
- 查看响应时间
- 查看错误日志

### PlanetScale 控制台
- 查看数据库大小
- 查看查询性能

---

## 备份

### 数据库备份
```bash
# 使用 PlanetScale CLI
pscale database dump task-reward main
```

### 定期备份建议
- 每周备份一次
- 保留最近 4 周的备份

---

祝你部署顺利！🚀
