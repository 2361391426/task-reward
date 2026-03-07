# ✅ 问题已解决！

## 问题原因

前端的 `.env` 文件配置的是生产环境地址：
```
VITE_API_BASE_URL=https://your-project.vercel.app/api
```

导致前端无法连接到本地后端。

## 已修复

已将 `.env` 文件更新为本地地址：
```
VITE_API_BASE_URL=http://localhost:3001/api
```

并重启了商家端服务。

## 🚀 现在可以测试了！

### 访问地址
```
http://localhost:3003
```

### 登录信息
- 用户名：`admin`
- 密码：`admin123`

### 服务状态
```
✅ 后端 API：http://localhost:3001 - 运行正常
✅ 商家端：http://localhost:3003 - 运行正常
✅ 数据库：test.db - 已初始化
```

## 测试步骤

### 1. 打开浏览器
访问：http://localhost:3003

### 2. 登录
- 输入用户名：`admin`
- 输入密码：`admin123`
- 点击"登录"

### 3. 测试功能
登录成功后，你可以：

#### 数据概览
- 查看统计数据（任务数、提交数等）
- 查看最近提交列表

#### 任务管理
1. 点击左侧菜单"任务管理"
2. 点击"创建任务"按钮
3. 填写表单：
   - 任务标题：`测试任务 - 淘宝刷单`
   - 搜索关键词：`女装连衣裙`
   - 店铺名称：`时尚女装店`
   - 商品名称：`夏季连衣裙`
   - 奖励金额：`15.50`
   - 任务名额：`50`
   - 结束时间：选择未来日期
4. 点击"创建"
5. 查看任务列表

#### 提交审核
1. 点击左侧菜单"提交审核"
2. 查看提交列表（目前为空，因为还没有用户提交）
3. 可以测试筛选功能（全部/待审核/已通过/已驳回）

## 验证后端 API

### 使用浏览器
访问：http://localhost:3001/api/health

应该看到：
```json
{
  "code": 0,
  "message": "OK",
  "data": {
    "status": "healthy"
  }
}
```

### 使用 curl
```bash
# 健康检查
curl http://localhost:3001/api/health

# 商家登录
curl -X POST http://localhost:3001/api/merchant/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 获取任务列表
curl http://localhost:3001/api/tasks
```

## 查看数据库

```bash
cd /f/task-reward-miniapp/task-reward-backend

# 使用 SQLite 命令行
sqlite3 test.db

# 查看所有表
.tables

# 查看商家
SELECT * FROM merchants;

# 查看任务
SELECT * FROM tasks;

# 退出
.quit
```

## 如果还有问题

### 清除浏览器缓存
1. 按 F12 打开开发者工具
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

### 检查网络请求
1. 按 F12 打开开发者工具
2. 切换到 Network 标签
3. 尝试登录
4. 查看请求是否发送到 http://localhost:3001

### 查看控制台错误
1. 按 F12 打开开发者工具
2. 切换到 Console 标签
3. 查看是否有错误信息

## 日志位置

### 后端日志
```bash
cd /f/task-reward-miniapp/task-reward-backend
cat server.log
```

### 商家端日志
```bash
cd /f/task-reward-miniapp/merchant-admin
cat merchant.log
```

## 停止服务

如果需要停止服务：

```bash
# 停止后端
pkill -f "node server-local"

# 停止商家端
pkill -f "vite"
```

---

**现在登录应该可以正常工作了！** 🎉

**访问地址**：http://localhost:3003
**登录信息**：admin / admin123
