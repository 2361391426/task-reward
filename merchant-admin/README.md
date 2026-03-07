# 商家端管理后台

任务返现平台 - 商家端管理后台

## 技术栈

- Vue 3
- Vite
- Element Plus
- Vue Router
- Pinia
- Axios

## 功能模块

### 1. 登录认证
- 商家账号密码登录
- Token 认证
- 自动登录

### 2. 数据概览
- 总任务数统计
- 总提交数统计
- 待审核数量
- 总支出金额
- 最近提交列表

### 3. 任务管理
- 任务列表展示
- 创建新任务
- 任务状态管理
- 名额管理

### 4. 提交审核
- 提交列表展示
- 按状态筛选（全部/待审核/已通过/已驳回）
- 查看提交详情（8张截图）
- 审核通过/驳回
- 驳回原因填写

## 安装运行

### 1. 安装依赖
```bash
cd merchant-admin
npm install
```

### 2. 配置 API 地址
修改 `.env` 文件：
```
VITE_API_BASE_URL=https://your-project.vercel.app/api
```

### 3. 运行开发环境
```bash
npm run dev
```

访问 http://localhost:3000

### 4. 构建生产版本
```bash
npm run build
```

## 默认账号

- 用户名: `admin`
- 密码: `admin123`

## 目录结构

```
merchant-admin/
├── src/
│   ├── api/              # API 接口
│   │   └── merchant.js   # 商家端接口
│   ├── layouts/          # 布局组件
│   │   └── MainLayout.vue
│   ├── router/           # 路由配置
│   │   └── index.js
│   ├── stores/           # 状态管理
│   │   └── auth.js       # 认证状态
│   ├── utils/            # 工具函数
│   │   └── request.js    # 请求封装
│   ├── views/            # 页面组件
│   │   ├── Login.vue     # 登录页
│   │   ├── Dashboard.vue # 数据概览
│   │   ├── Tasks.vue     # 任务管理
│   │   └── Submissions.vue # 提交审核
│   ├── App.vue           # 根组件
│   └── main.js           # 入口文件
├── index.html
├── vite.config.js
├── package.json
└── .env
```

## 页面路由

- `/login` - 登录页
- `/dashboard` - 数据概览
- `/tasks` - 任务管理
- `/submissions` - 提交审核

## 部署

### Vercel 部署

1. 安装 Vercel CLI
```bash
npm i -g vercel
```

2. 部署
```bash
vercel --prod
```

### Nginx 部署

1. 构建项目
```bash
npm run build
```

2. 将 `dist` 目录上传到服务器

3. Nginx 配置
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass https://your-backend.vercel.app;
    }
}
```

## 注意事项

1. 需要先部署后端 API
2. 修改 `.env` 中的 API 地址
3. 生产环境建议使用 HTTPS
4. 建议配置 CDN 加速静态资源
