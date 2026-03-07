# 任务返现小程序

电商任务返现平台 - 用户端小程序

## 项目结构

```
task-reward-miniapp/
├── pages/                    # 页面
│   ├── index/               # 任务列表页
│   ├── task-detail/         # 任务详情页
│   ├── upload/              # 图片上传页
│   └── my/                  # 我的页面
├── components/              # 组件
├── api/                     # API接口
│   ├── task.js             # 任务相关接口
│   └── user.js             # 用户相关接口
├── utils/                   # 工具类
│   ├── request.js          # 请求封装
│   └── upload.js           # 上传工具
├── static/                  # 静态资源
│   ├── css/                # 样式
│   ├── images/             # 图片
│   └── tabbar/             # 底部导航图标
├── App.vue                  # 应用入口
├── main.js                  # 主入口
├── pages.json              # 页面配置
├── manifest.json           # 应用配置
└── package.json            # 依赖配置
```

## 功能模块

### 1. 任务列表页 (pages/index)
- 展示可接任务列表
- 显示任务奖励、剩余名额
- 点击进入任务详情

### 2. 任务详情页 (pages/task-detail)
- 显示任务详细信息
- 展示任务要求（8张截图）
- 注意事项说明
- 开始任务按钮

### 3. 图片上传页 (pages/upload)
- 分步骤上传8张截图：
  1. 搜索关键词截图（1张）
  2. 浏览其他店铺截图（3张）
  3. 主图点关注评论截图（1张）
  4. 分享截图（1张）
  5. 商品详情页浏览截图（1张）
  6. 商品加购截图（1张）
- 填写手机号
- 提交审核

### 4. 我的页面 (pages/my)
- 用户信息展示
- 累计收益统计
- 任务提交记录
- 审核状态查看

## 安装运行

### 1. 安装依赖
```bash
npm install
```

### 2. 配置后端API地址
修改 `utils/request.js` 中的 `BASE_URL`：
```javascript
const BASE_URL = 'https://your-api-domain.com/api'
```

修改 `utils/upload.js` 中的 `UPLOAD_URL`：
```javascript
const UPLOAD_URL = 'https://your-api-domain.com/api/upload'
```

### 3. 配置微信小程序 AppID
修改 `manifest.json` 中的 `appid`：
```json
{
  "mp-weixin": {
    "appid": "你的小程序AppID"
  }
}
```

### 4. 运行开发环境
```bash
npm run dev:mp-weixin
```

### 5. 使用微信开发者工具
1. 打开微信开发者工具
2. 导入项目，选择 `dist/dev/mp-weixin` 目录
3. 开始开发调试

### 6. 构建生产版本
```bash
npm run build:mp-weixin
```

## API 接口说明

### 用户相关
- `POST /api/user/login` - 微信登录
- `GET /api/user/info` - 获取用户信息
- `GET /api/user/earnings` - 获取收益信息

### 任务相关
- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/:id` - 获取任务详情
- `POST /api/submissions` - 提交任务
- `GET /api/submissions/my` - 我的提交记录

### 文件上传
- `POST /api/upload` - 上传图片

## 数据格式

### 提交任务数据
```json
{
  "task_id": 1,
  "phone_number": "13800138000",
  "screenshot_search": "https://...",
  "screenshot_shop_1": "https://...",
  "screenshot_shop_2": "https://...",
  "screenshot_shop_3": "https://...",
  "screenshot_follow": "https://...",
  "screenshot_share": "https://...",
  "screenshot_detail": "https://...",
  "screenshot_cart": "https://..."
}
```

## 注意事项

1. 需要配置微信小程序的服务器域名白名单
2. 图片上传需要后端支持 multipart/form-data
3. 建议使用对象存储（OSS/COS）存储图片
4. 手机号需要加密存储
5. 添加防刷机制（IP限制、设备指纹等）

## 下一步开发

- [ ] 添加微信登录功能
- [ ] 完善错误处理
- [ ] 添加图片压缩
- [ ] 添加图片水印
- [ ] 优化上传体验
- [ ] 添加消息通知
- [ ] 添加分享功能

## 技术栈

- uni-app
- Vue 3
- 微信小程序
