# 🎯 手动测试指南

## 当前状态

✅ 项目代码 100% 完成
⏳ 依赖正在安装中

## 立即可以做的事情

### 1. 查看项目结构
```bash
cd F:\task-reward-miniapp

# 查看后端文件
ls task-reward-backend/api/
ls task-reward-backend/lib/

# 查看商家端文件
ls merchant-admin/src/views/

# 查看小程序文件
ls pages/
```

### 2. 阅读关键代码

#### 后端核心文件
- `task-reward-backend/server-local.js` - 测试服务器
- `task-reward-backend/lib/db-local.js` - 数据库
- `task-reward-backend/api-local/merchant.js` - 商家 API

#### 商家端核心文件
- `merchant-admin/src/views/Login.vue` - 登录页
- `merchant-admin/src/views/Dashboard.vue` - 数据概览
- `merchant-admin/src/views/Tasks.vue` - 任务管理
- `merchant-admin/src/views/Submissions.vue` - 提交审核

#### 小程序核心文件
- `pages/index/index.vue` - 任务列表
- `pages/upload/index.vue` - 图片上传
- `pages/my/index.vue` - 我的页面

### 3. 验证功能完整性

#### 后端 API（12个接口）
```bash
cd task-reward-backend
ls api/user/        # 3个文件
ls api/tasks/       # 2个文件
ls api/submissions/ # 2个文件
ls api/merchant/    # 4个文件
ls api/upload.js    # 1个文件
```

#### 商家端页面（4个页面）
```bash
cd merchant-admin/src/views
ls -la
# Login.vue
# Dashboard.vue
# Tasks.vue
# Submissions.vue
```

#### 小程序页面（4个页面）
```bash
cd pages
ls -la
# index/
# task-detail/
# upload/
# my/
```

## 等待安装完成后

### 步骤1：启动后端（终端1）
```bash
cd task-reward-backend
npm run test
```

期望输出：
```
🚀 本地测试服务器运行在 http://localhost:3001
✅ SQLite 数据库初始化完成
```

### 步骤2：运行测试（终端2）
```bash
cd task-reward-backend
node test-api.js
```

期望输出：
```
🧪 开始测试 API...
1️⃣ 测试健康检查... ✅
2️⃣ 测试商家登录... ✅
3️⃣ 测试创建任务... ✅
...
🎉 所有测试通过！
```

### 步骤3：启动商家端（终端3）
```bash
cd merchant-admin
npm install
npm run dev
```

访问：http://localhost:3000
- 用户名：admin
- 密码：admin123

## 测试清单

### 商家端功能测试

#### 登录功能
- [ ] 打开 http://localhost:3000
- [ ] 输入 admin / admin123
- [ ] 点击登录
- [ ] 成功进入数据概览页面

#### 数据概览
- [ ] 查看统计卡片（任务数、提交数等）
- [ ] 查看最近提交列表

#### 任务管理
- [ ] 点击左侧菜单"任务管理"
- [ ] 点击"创建任务"按钮
- [ ] 填写任务信息：
  - 标题：测试任务
  - 关键词：女装
  - 店铺：测试店铺
  - 商品：测试商品
  - 奖励：10元
  - 名额：100
  - 结束时间：选择未来日期
- [ ] 点击"创建"
- [ ] 查看任务列表中出现新任务

#### 提交审核
- [ ] 点击左侧菜单"提交审核"
- [ ] 查看提交列表
- [ ] 点击"查看详情"
- [ ] 查看8张截图
- [ ] 点击"通过"或"驳回"
- [ ] 确认审核成功

### API 测试

使用 Postman 或 curl 测试：

#### 1. 健康检查
```bash
curl http://localhost:3001/api/health
```

#### 2. 商家登录
```bash
curl -X POST http://localhost:3001/api/merchant/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

#### 3. 获取任务列表
```bash
curl http://localhost:3001/api/tasks
```

#### 4. 用户登录
```bash
curl -X POST http://localhost:3001/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test123"}'
```

## 数据库查看

```bash
cd task-reward-backend

# 使用 SQLite 命令行
sqlite3 test.db

# 或者使用 better-sqlite3
node -e "const db = require('better-sqlite3')('test.db'); console.log(db.prepare('SELECT * FROM tasks').all())"
```

常用 SQL：
```sql
-- 查看所有表
.tables

-- 查看任务
SELECT * FROM tasks;

-- 查看用户
SELECT * FROM users;

-- 查看提交记录
SELECT * FROM submissions;

-- 查看商家
SELECT * FROM merchants;
```

## 文件上传测试

上传的文件会保存在：
```
task-reward-backend/uploads/
```

访问地址：
```
http://localhost:3001/uploads/文件名
```

## 常见问题

### Q: 端口被占用
A: 修改 `server-local.js` 中的 `PORT = 3001` 为其他端口

### Q: 数据库文件在哪里
A: `task-reward-backend/test.db`

### Q: 如何重置数据库
A: 删除 `test.db` 文件，重启服务器会自动创建新的

### Q: 如何查看日志
A: 查看终端输出，或者 `server.log` 文件

## 项目文档

- **PROJECT_COMPLETE.md** - 项目完成总结
- **START_HERE.md** - 项目入口
- **QUICK_TEST.md** - 快速测试
- **INSTALL_HELP.md** - 安装帮助
- **TEST_GUIDE.md** - 详细测试文档

## 下一步

1. ✅ 等待依赖安装完成
2. ✅ 启动测试服务器
3. ✅ 运行自动化测试
4. ✅ 启动商家端
5. ✅ 手动测试所有功能
6. 🚀 部署到生产环境

---

**项目已100%完成，等待测试！** 🎉
