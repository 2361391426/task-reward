# 后端 API 接口文档

## 基础说明

### 请求格式
- Content-Type: application/json
- 需要认证的接口在 Header 中携带: `Authorization: Bearer {token}`

### 响应格式
```json
{
  "code": 0,           // 0表示成功，其他表示失败
  "message": "success", // 提示信息
  "data": {}           // 响应数据
}
```

### 错误码
- 0: 成功
- 1001: 参数错误
- 1002: 未登录
- 1003: 无权限
- 2001: 用户不存在
- 2002: 任务不存在
- 2003: 任务已结束
- 2004: 名额已满
- 2005: 已提交过该任务
- 3001: 余额不足
- 3002: 提现金额不足
- 4001: 审核失败

---

## 用户端 API

### 1. 用户登录

**POST** `/api/user/login`

**请求参数:**
```json
{
  "code": "微信登录code"
}
```

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "token": "jwt_token_string",
    "user": {
      "id": 1,
      "nickname": "用户昵称",
      "avatar": "头像URL",
      "total_earnings": 128.50,
      "available_balance": 50.00
    }
  }
}
```

### 2. 获取用户信息

**GET** `/api/user/info`

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "nickname": "用户昵称",
    "avatar": "头像URL",
    "phone": "138****8000",
    "total_earnings": 128.50,
    "available_balance": 50.00,
    "frozen_balance": 20.00
  }
}
```

### 3. 获取用户收益信息

**GET** `/api/user/earnings`

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "total_earnings": 128.50,
    "available_balance": 50.00,
    "frozen_balance": 20.00,
    "today_earnings": 15.00,
    "month_earnings": 85.00
  }
}
```

### 4. 获取收益明细

**GET** `/api/user/earnings/records`

**请求参数:**
```
?page=1&page_size=20&type=1
```

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "total": 50,
    "page": 1,
    "page_size": 20,
    "list": [
      {
        "id": 1,
        "type": 1,
        "amount": 5.00,
        "balance_after": 50.00,
        "description": "任务奖励",
        "created_at": "2024-03-06 10:30:00"
      }
    ]
  }
}
```

### 5. 获取任务列表

**GET** `/api/tasks`

**请求参数:**
```
?page=1&page_size=10&status=1
```

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "total": 20,
    "page": 1,
    "page_size": 10,
    "list": [
      {
        "id": 1,
        "title": "搜索购买女装",
        "reward_amount": 5.00,
        "total_quota": 100,
        "remaining_quota": 50,
        "status": 1,
        "created_at": "2024-03-06 10:00:00"
      }
    ]
  }
}
```

### 6. 获取任务详情

**GET** `/api/tasks/:id`

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "title": "搜索购买女装",
    "description": "任务详细说明",
    "reward_amount": 5.00,
    "total_quota": 100,
    "remaining_quota": 50,
    "search_keyword": "女装连衣裙",
    "shop_name": "某某旗舰店",
    "product_link": "https://...",
    "requirements": {
      "steps": [
        "打开淘宝搜索关键词",
        "浏览至少3家其他店铺",
        "进入指定店铺点关注和评论",
        "分享商品",
        "浏览商品详情页",
        "加入购物车"
      ],
      "screenshots": [
        "搜索关键词截图",
        "浏览店铺截图（3张）",
        "关注评论截图",
        "分享截图",
        "详情页截图",
        "加购截图"
      ]
    },
    "status": 1,
    "start_time": "2024-03-06 00:00:00",
    "end_time": "2024-03-10 23:59:59"
  }
}
```

### 7. 提交任务

**POST** `/api/submissions`

**请求参数:**
```json
{
  "task_id": 1,
  "phone_number": "13800138000",
  "screenshot_search": "https://oss.example.com/1.jpg",
  "screenshot_shop_1": "https://oss.example.com/2.jpg",
  "screenshot_shop_2": "https://oss.example.com/3.jpg",
  "screenshot_shop_3": "https://oss.example.com/4.jpg",
  "screenshot_follow": "https://oss.example.com/5.jpg",
  "screenshot_share": "https://oss.example.com/6.jpg",
  "screenshot_detail": "https://oss.example.com/7.jpg",
  "screenshot_cart": "https://oss.example.com/8.jpg"
}
```

**响应数据:**
```json
{
  "code": 0,
  "message": "提交成功，等待审核",
  "data": {
    "submission_id": 123
  }
}
```

### 8. 获取我的提交记录

**GET** `/api/submissions/my`

**请求参数:**
```
?page=1&page_size=20&status=0
```

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "total": 15,
    "page": 1,
    "page_size": 20,
    "list": [
      {
        "id": 123,
        "task_id": 1,
        "task_title": "搜索购买女装",
        "reward_amount": 5.00,
        "status": 0,
        "reject_reason": null,
        "created_at": "2024-03-06 10:30:00",
        "reviewed_at": null
      }
    ]
  }
}
```

### 9. 上传图片

**POST** `/api/upload`

**请求参数:**
- Content-Type: multipart/form-data
- file: 图片文件

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "url": "https://oss.example.com/uploads/20240306/abc123.jpg"
  }
}
```

### 10. 申请提现

**POST** `/api/withdrawals`

**请求参数:**
```json
{
  "amount": 50.00,
  "withdraw_type": 1,
  "account_info": {
    "name": "张三",
    "account": "微信账号或支付宝账号"
  }
}
```

**响应数据:**
```json
{
  "code": 0,
  "message": "提现申请已提交",
  "data": {
    "withdrawal_id": 456,
    "actual_amount": 49.50
  }
}
```

---

## 商家端 API

### 1. 商家登录

**POST** `/api/merchant/login`

**请求参数:**
```json
{
  "username": "merchant001",
  "password": "password123"
}
```

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "token": "jwt_token_string",
    "merchant": {
      "id": 1,
      "username": "merchant001",
      "company_name": "某某公司",
      "balance": 1000.00
    }
  }
}
```

### 2. 获取商家信息

**GET** `/api/merchant/info`

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "username": "merchant001",
    "company_name": "某某公司",
    "contact_name": "张经理",
    "contact_phone": "13800138000",
    "email": "merchant@example.com",
    "balance": 1000.00
  }
}
```

### 3. 创建任务

**POST** `/api/merchant/tasks`

**请求参数:**
```json
{
  "title": "搜索购买女装",
  "description": "任务详细说明",
  "reward_amount": 5.00,
  "total_quota": 100,
  "search_keyword": "女装连衣裙",
  "shop_name": "某某旗舰店",
  "product_link": "https://...",
  "requirements": {
    "steps": ["步骤1", "步骤2"],
    "screenshots": ["截图要求1", "截图要求2"]
  },
  "start_time": "2024-03-06 00:00:00",
  "end_time": "2024-03-10 23:59:59"
}
```

**响应数据:**
```json
{
  "code": 0,
  "message": "任务创建成功",
  "data": {
    "task_id": 1
  }
}
```

### 4. 获取商家任务列表

**GET** `/api/merchant/tasks`

**请求参数:**
```
?page=1&page_size=10&status=1
```

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "total": 5,
    "page": 1,
    "page_size": 10,
    "list": [
      {
        "id": 1,
        "title": "搜索购买女装",
        "reward_amount": 5.00,
        "total_quota": 100,
        "remaining_quota": 50,
        "submission_count": 50,
        "pending_review": 10,
        "approved": 35,
        "rejected": 5,
        "status": 1,
        "created_at": "2024-03-06 10:00:00"
      }
    ]
  }
}
```

### 5. 获取任务提交列表（待审核）

**GET** `/api/merchant/submissions`

**请求参数:**
```
?task_id=1&page=1&page_size=20&status=0
```

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "total": 10,
    "page": 1,
    "page_size": 20,
    "list": [
      {
        "id": 123,
        "task_id": 1,
        "task_title": "搜索购买女装",
        "user_nickname": "用户昵称",
        "phone_number": "138****8000",
        "screenshot_search": "https://...",
        "screenshot_shop_1": "https://...",
        "screenshot_shop_2": "https://...",
        "screenshot_shop_3": "https://...",
        "screenshot_follow": "https://...",
        "screenshot_share": "https://...",
        "screenshot_detail": "https://...",
        "screenshot_cart": "https://...",
        "status": 0,
        "created_at": "2024-03-06 10:30:00"
      }
    ]
  }
}
```

### 6. 审核任务提交

**POST** `/api/merchant/submissions/:id/review`

**请求参数:**
```json
{
  "status": 1,
  "reject_reason": "截图不清晰"
}
```

**响应数据:**
```json
{
  "code": 0,
  "message": "审核成功"
}
```

### 7. 暂停/恢复任务

**PUT** `/api/merchant/tasks/:id/status`

**请求参数:**
```json
{
  "status": 2
}
```

**响应数据:**
```json
{
  "code": 0,
  "message": "操作成功"
}
```

### 8. 商家充值

**POST** `/api/merchant/recharge`

**请求参数:**
```json
{
  "amount": 1000.00,
  "payment_method": 1
}
```

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "recharge_id": 789,
    "payment_url": "https://pay.example.com/..."
  }
}
```

### 9. 获取数据统计

**GET** `/api/merchant/statistics`

**请求参数:**
```
?start_date=2024-03-01&end_date=2024-03-06
```

**响应数据:**
```json
{
  "code": 0,
  "data": {
    "total_tasks": 10,
    "active_tasks": 5,
    "total_submissions": 500,
    "pending_review": 50,
    "approved": 400,
    "rejected": 50,
    "total_spent": 2000.00,
    "daily_stats": [
      {
        "date": "2024-03-06",
        "submissions": 50,
        "approved": 40,
        "spent": 200.00
      }
    ]
  }
}
```

---

## 管理员 API

### 1. 管理员登录

**POST** `/api/admin/login`

### 2. 用户管理

**GET** `/api/admin/users`
**PUT** `/api/admin/users/:id/status`

### 3. 商家管理

**GET** `/api/admin/merchants`
**POST** `/api/admin/merchants`
**PUT** `/api/admin/merchants/:id`

### 4. 提现审核

**GET** `/api/admin/withdrawals`
**POST** `/api/admin/withdrawals/:id/review`

### 5. 系统配置

**GET** `/api/admin/config`
**PUT** `/api/admin/config`

### 6. 平台数据统计

**GET** `/api/admin/statistics`

---

## 认证说明

### JWT Token 结构
```json
{
  "user_id": 1,
  "type": "user",  // user/merchant/admin
  "exp": 1234567890
}
```

### Token 过期时间
- 用户端: 7天
- 商家端: 24小时
- 管理员: 12小时
