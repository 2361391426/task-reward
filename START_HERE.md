# 项目启动说明

## 项目组成

1. `task-reward-backend/`：后端 API
2. `merchant-admin/`：商家管理后台
3. `pages/`：小程序主源码
4. `src/`：小程序镜像源码，保留兼容历史结构

## 运行端口

1. 后端本地服务：`http://localhost:3001`
2. 商家后台开发服务：`http://localhost:3000`
3. 小程序构建输出：`dist/dev/mp-weixin`

## 推荐启动方式

### 一键启动本地联调

双击仓库根目录的 `start-all.bat`。

启动后会同时打开：

1. 后端本地服务
2. 商家后台开发服务

### 分开启动

#### 后端

```bash
cd task-reward-backend
npm run start:local
```

#### 商家后台

```bash
cd merchant-admin
npm run dev
```

#### 小程序

```bash
npm run dev:mp-weixin
```

## 常用脚本

### 后端

- `npm run start:local`：启动本地后端
- `npm test`：执行 smoke 测试
- `npm run test:p2`：执行 P2 回归测试

### 根目录

- `npm run dev:mp-weixin`：启动小程序开发构建
- `npm run build:mp-weixin`：构建小程序

## 商家后台默认账号

- 用户名：`admin`
- 密码：`admin123`

## 本地测试流程

1. 启动后端
2. 运行 `npm test`
3. 启动商家后台
4. 启动小程序构建并导入微信开发者工具

## 目录说明

### 后端

- `api/`：生产环境 API
- `api-local/`：本地联调 API
- `lib/`：公共库
- `scripts/`：测试和备份脚本

### 小程序

- `pages/`：页面源码
- `utils/`：请求和上传工具
- `static/`：静态资源

### 商家后台

- `merchant-admin/src/views/`：页面
- `merchant-admin/src/router/`：路由
- `merchant-admin/src/utils/`：请求封装

## 说明

1. 当前仓库保留了部分历史目录和镜像文件，用于兼容旧构建方式。
2. 新功能优先改主入口文件，避免同时改多份相同逻辑。
3. 如果你只想快速确认结果，先看 `npm test` 和 `npm run test:p2`。
