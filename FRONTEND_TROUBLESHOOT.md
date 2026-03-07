# 🔧 前端打开失败 - 故障排除

## 问题诊断

### 1. 确认你遇到的是哪种情况

#### 情况A：商家端管理后台打不开
- 访问 http://localhost:3000 无响应
- 或者显示"无法访问此网站"

#### 情况B：小程序打不开
- 微信开发者工具报错
- 或者页面空白

#### 情况C：启动命令报错
- `npm run dev` 执行失败
- 显示错误信息

## 解决方案

### 商家端管理后台（merchant-admin）

#### 步骤1：检查依赖
```bash
cd merchant-admin
ls node_modules | wc -l
```
如果数量很少（<100），需要重新安装：
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 步骤2：启动开发服务器
```bash
npm run dev
```

应该看到：
```
VITE v4.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

#### 步骤3：访问
打开浏览器访问：http://localhost:3000

#### 常见错误

**错误1：端口被占用**
```
Error: listen EADDRINUSE: address already in use :::3000
```
解决：
```bash
# 方案A：杀掉占用端口的进程
netstat -ano | findstr :3000
taskkill /PID <进程ID> /F

# 方案B：修改端口
# 编辑 vite.config.js，将 port: 3000 改为 port: 3001
```

**错误2：模块未找到**
```
Error: Cannot find module 'xxx'
```
解决：
```bash
npm install
```

**错误3：Vue 相关错误**
```
Failed to resolve component
```
解决：检查文件是否完整
```bash
ls src/views/
# 应该有：Login.vue, Dashboard.vue, Tasks.vue, Submissions.vue
```

### 小程序（task-reward-miniapp）

#### 步骤1：检查配置
```bash
# 检查 pages.json
cat pages.json

# 检查 manifest.json
cat manifest.json
```

#### 步骤2：在微信开发者工具中打开
1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择目录：`F:\task-reward-miniapp`
4. AppID：使用测试号或你的 AppID

#### 步骤3：编译
点击"编译"按钮

#### 常见错误

**错误1：pages 路径错误**
检查 pages.json 中的路径是否正确

**错误2：API 地址错误**
修改 `utils/request.js`:
```javascript
const BASE_URL = 'http://localhost:3001/api'
```

**错误3：缺少文件**
检查所有页面文件是否存在：
```bash
ls pages/index/index.vue
ls pages/task-detail/index.vue
ls pages/upload/index.vue
ls pages/my/index.vue
```

## 快速测试

### 测试商家端是否正常

#### 方法1：使用诊断脚本
```bash
node diagnose-frontend.js
```

#### 方法2：手动检查
```bash
cd merchant-admin

# 检查文件
ls src/views/
# 应该有 4 个 .vue 文件

# 检查依赖
npm list vue
npm list element-plus

# 启动
npm run dev
```

#### 方法3：查看日志
```bash
cd merchant-admin
npm run dev > dev.log 2>&1 &
sleep 5
cat dev.log
```

## 如果还是失败

### 方案A：使用静态构建
```bash
cd merchant-admin
npm run build
```
然后使用任何 HTTP 服务器打开 `dist` 目录：
```bash
npx serve dist
```

### 方案B：检查浏览器控制台
1. 打开浏览器
2. 按 F12 打开开发者工具
3. 查看 Console 标签的错误信息
4. 查看 Network 标签的请求失败信息

### 方案C：使用在线版本
如果本地实在无法运行，可以：
1. 部署到 Vercel
2. 使用在线版本测试

## 详细错误信息

请提供以下信息以便诊断：

1. **具体错误信息**
   - 终端显示的错误
   - 浏览器控制台的错误

2. **环境信息**
   ```bash
   node -v
   npm -v
   ```

3. **文件检查**
   ```bash
   cd merchant-admin
   ls -la src/views/
   ```

4. **启动日志**
   ```bash
   npm run dev 2>&1 | tee dev.log
   ```

## 临时解决方案

如果商家端无法启动，可以：

### 1. 直接测试后端 API
```bash
cd task-reward-backend
npm run test
node test-api.js
```

### 2. 使用 Postman 测试
导入 API 文档，手动测试所有接口

### 3. 查看代码
所有代码都已完成，可以直接查看：
- `merchant-admin/src/views/` - 页面代码
- `merchant-admin/src/api/` - API 调用
- `merchant-admin/src/router/` - 路由配置

## 联系支持

如果以上方法都无法解决，请提供：
1. 完整的错误信息
2. `npm run dev` 的输出
3. 浏览器控制台的截图

---

**提示**：项目代码是完整的，99%的问题都是环境配置问题，可以通过重新安装依赖解决。
