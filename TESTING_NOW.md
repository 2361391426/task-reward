# 🚀 服务已启动 - 测试指南

## ✅ 当前运行状态

### 后端 API 服务器
- **地址**：http://localhost:3001
- **状态**：✅ 运行中
- **健康检查**：http://localhost:3001/api/health

### 商家端管理后台
- **地址**：http://localhost:3003 ⭐
- **状态**：✅ 运行中
- **登录信息**：
  - 用户名：`admin`
  - 密码：`admin123`

## 📝 测试步骤

### 1. 访问商家端
在浏览器打开：**http://localhost:3003**

### 2. 登录系统
- 输入用户名：`admin`
- 输入密码：`admin123`
- 点击"登录"按钮

### 3. 测试数据概览
登录后会看到：
- 总任务数统计
- 总提交数统计
- 待审核数量
- 总支出金额
- 最近提交列表

### 4. 测试创建任务
1. 点击左侧菜单"任务管理"
2. 点击右上角"创建任务"按钮
3. 填写表单：
   - 任务标题：`测试任务 - 淘宝刷单`
   - 搜索关键词：`女装连衣裙`
   - 店铺名称：`时尚女装店`
   - 商品名称：`夏季连衣裙`
   - 奖励金额：`15.50`
   - 任务名额：`50`
   - 结束时间：选择未来日期
4. 点击"创建"
5. 查看任务列表中是否出现新任务

### 5. 测试提交审核
1. 点击左侧菜单"提交审核"
2. 查看提交列表（如果有数据）
3. 点击"查看详情"查看截图
4. 测试"通过"或"驳回"功能

## 🧪 API 测试

### 使用浏览器测试

#### 1. 健康检查
访问：http://localhost:3001/api/health

应该返回：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "healthy"
  }
}
```

#### 2. 获取任务列表
访问：http://localhost:3001/api/tasks

应该返回任务列表

### 使用 curl 测试

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

## 📊 测试清单

### 商家端功能
- [ ] 登录页面显示正常
- [ ] 登录成功
- [ ] 数据概览页面显示
- [ ] 左侧菜单可点击
- [ ] 创建任务表单显示
- [ ] 创建任务成功
- [ ] 任务列表显示
- [ ] 提交列表显示
- [ ] 查看详情功能
- [ ] 审核功能

### 后端 API
- [ ] 健康检查接口正常
- [ ] 商家登录接口正常
- [ ] 任务列表接口正常
- [ ] 创建任务接口正常

## 🔍 查看日志

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

### 实时查看日志
```bash
# 后端
tail -f /f/task-reward-miniapp/task-reward-backend/server.log

# 商家端
tail -f /f/task-reward-miniapp/merchant-admin/merchant.log
```

## 🗄️ 查看数据库

```bash
cd /f/task-reward-miniapp/task-reward-backend

# 使用 SQLite 命令行
sqlite3 test.db

# 查看所有表
.tables

# 查看任务
SELECT * FROM tasks;

# 查看商家
SELECT * FROM merchants;

# 查看用户
SELECT * FROM users;

# 退出
.quit
```

## ❓ 常见问题

### Q: 页面打不开
A: 确认访问的是 http://localhost:3003（不是 3000）

### Q: 登录失败
A: 确认用户名是 `admin`，密码是 `admin123`

### Q: 看不到数据
A: 这是正常的，因为是新数据库，需要先创建任务

### Q: 如何停止服务
A:
```bash
# 查找进程
ps aux | grep node

# 停止进程
kill <进程ID>

# 或者关闭终端窗口
```

## 🎯 下一步

测试完成后，你可以：

1. **部署到生产环境**
   - 参考 QUICK_START.md
   - 部署到 Vercel

2. **配置小程序**
   - 修改 API 地址
   - 在微信开发者工具中测试

3. **扩展功能**
   - 添加提现功能
   - 添加消息通知
   - 添加数据统计

## 📞 需要帮助？

如果遇到问题：
1. 查看浏览器控制台（F12）
2. 查看服务器日志
3. 检查网络请求
4. 参考 FRONTEND_TROUBLESHOOT.md

---

**祝测试顺利！** 🎉

**重要提醒**：访问地址是 http://localhost:3003（不是 3000）
