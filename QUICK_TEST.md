# 🚀 快速测试指南

## 第一步：安装依赖

打开终端，执行以下命令：

```bash
# 1. 安装后端依赖
cd task-reward-backend
npm install

# 2. 安装商家端依赖
cd ../merchant-admin
npm install
```

## 第二步：启动后端测试服务器

```bash
cd task-reward-backend
npm run test
```

你应该看到：
```
🚀 本地测试服务器运行在 http://localhost:3001
📝 API 文档: http://localhost:3001/api/health
📁 上传目录: F:\task-reward-miniapp\task-reward-backend\uploads
```

**保持这个终端窗口打开！**

## 第三步：测试 API（新开一个终端）

```bash
cd task-reward-backend
node test-api.js
```

你应该看到完整的测试流程：
```
🧪 开始测试 API...

1️⃣ 测试健康检查...
✅ 健康检查通过

2️⃣ 测试商家登录...
✅ 商家登录成功

3️⃣ 测试创建任务...
✅ 任务创建成功

...

🎉 所有测试通过！
```

## 第四步：启动商家端管理后台（新开一个终端）

```bash
cd merchant-admin
npm run dev
```

访问 http://localhost:3000

登录信息：
- 用户名: `admin`
- 密码: `admin123`

## 测试功能

### 在商家端测试：

1. **数据概览**
   - 查看统计数据
   - 查看最近提交

2. **任务管理**
   - 点击"创建任务"
   - 填写任务信息
   - 提交创建
   - 查看任务列表

3. **提交审核**
   - 查看提交列表
   - 点击"查看详情"
   - 查看8张截图
   - 点击"通过"或"驳回"

## 验证结果

### 1. 检查数据库

```bash
cd task-reward-backend
sqlite3 test.db

# 查看任务
SELECT * FROM tasks;

# 查看提交记录
SELECT * FROM submissions;

# 查看用户余额
SELECT id, balance, total_earnings FROM users;
```

### 2. 检查上传的文件

查看目录：`task-reward-backend/uploads/`

## 常见问题

### Q: 端口被占用怎么办？
A: 修改 `server-local.js` 中的 `PORT = 3001` 改为其他端口

### Q: npm install 失败？
A: 尝试：
```bash
npm cache clean --force
npm install
```

### Q: SQLite 安装失败？
A: Windows 用户需要安装 Visual Studio Build Tools
```bash
npm install --global windows-build-tools
```

### Q: 商家端无法连接后端？
A: 检查 `merchant-admin/.env` 文件：
```
VITE_API_BASE_URL=http://localhost:3001/api
```

## 下一步

测试通过后，你可以：

1. ✅ 本地测试完成
2. 📱 配置小程序（修改 API 地址）
3. ☁️ 部署到 Vercel（参考 QUICK_START.md）
4. 🗄️ 配置真实数据库（PlanetScale）
5. 📦 配置文件存储（Cloudflare R2）

## 完整测试清单

- [ ] 后端服务器启动成功
- [ ] API 测试脚本全部通过
- [ ] 商家端登录成功
- [ ] 创建任务成功
- [ ] 查看任务列表
- [ ] 查看提交列表
- [ ] 审核提交成功
- [ ] 用户余额更新正确

全部完成后，项目就可以部署到生产环境了！🎉
