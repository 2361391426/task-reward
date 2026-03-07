# 后端实现方案

## 技术栈选择

### 推荐方案：Node.js + Express

```
- 运行环境: Node.js 18+
- Web框架: Express 4.x
- 数据库: MySQL 8.0
- ORM: Sequelize
- 缓存: Redis 7.x
- 认证: jsonwebtoken
- 加密: bcrypt, crypto
- 文件上传: multer
- 图片处理: sharp
- 任务队列: Bull (基于Redis)
- 日志: winston
- 参数验证: joi
- API文档: Swagger
```

---

## 项目结构

```
task-reward-backend/
├── src/
│   ├── config/              # 配置文件
│   │   ├── database.js      # 数据库配置
│   │   ├── redis.js         # Redis配置
│   │   ├── oss.js           # 对象存储配置
│   │   └── jwt.js           # JWT配置
│   ├── models/              # 数据模型
│   │   ├── User.js
│   │   ├── Merchant.js
│   │   ├── Task.js
│   │   ├── Submission.js
│   │   ├── Earning.js
│   │   ├── Withdrawal.js
│   │   └── index.js         # 模型关联
│   ├── controllers/         # 控制器
│   │   ├── user.controller.js
│   │   ├── merchant.controller.js
│   │   ├── task.controller.js
│   │   ├── submission.controller.js
│   │   ├── upload.controller.js
│   │   └── admin.controller.js
│   ├── services/            # 业务逻辑层
│   │   ├── auth.service.js
│   │   ├── task.service.js
│   │   ├── review.service.js
│   │   ├── finance.service.js
│   │   ├── wechat.service.js
│   │   └── oss.service.js
│   ├── middlewares/         # 中间件
│   │   ├── auth.js          # 认证中间件
│   │   ├── validate.js      # 参数验证
│   │   ├── errorHandler.js  # 错误处理
│   │   ├── rateLimit.js     # 限流
│   │   └── logger.js        # 日志
│   ├── routes/              # 路由
│   │   ├── user.routes.js
│   │   ├── merchant.routes.js
│   │   ├── task.routes.js
│   │   ├── upload.routes.js
│   │   └── index.js
│   ├── utils/               # 工具函数
│   │   ├── crypto.js        # 加密解密
│   │   ├── response.js      # 统一响应格式
│   │   ├── validator.js     # 验证器
│   │   └── logger.js        # 日志工具
│   ├── jobs/                # 定时任务
│   │   ├── taskExpire.js    # 任务过期处理
│   │   └── statistics.js   # 统计数据生成
│   └── app.js               # 应用入口
├── tests/                   # 测试文件
├── logs/                    # 日志目录
├── uploads/                 # 临时上传目录
├── .env                     # 环境变量
├── .env.example
├── package.json
└── README.md
```

---

## 核心模块实现

### 1. 数据模型定义 (Sequelize)

#### User Model
```javascript
// src/models/User.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    openid: {
      type: DataTypes.STRING(64),
      unique: true,
      allowNull: false
    },
    unionid: DataTypes.STRING(64),
    nickname: DataTypes.STRING(100),
    avatar: DataTypes.STRING(255),
    phone: DataTypes.STRING(255), // 加密存储
    totalEarnings: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    availableBalance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    frozenBalance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true
  });

  return User;
};
```

#### Task Model
```javascript
// src/models/Task.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Task = sequelize.define('Task', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    merchantId: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    description: DataTypes.TEXT,
    rewardAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    totalQuota: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    remainingQuota: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    searchKeyword: DataTypes.STRING(100),
    shopName: DataTypes.STRING(200),
    productLink: DataTypes.STRING(500),
    requirements: DataTypes.JSON,
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 1
    },
    startTime: DataTypes.DATE,
    endTime: DataTypes.DATE
  }, {
    tableName: 'tasks',
    timestamps: true,
    underscored: true
  });

  return Task;
};
```

#### Submission Model
```javascript
// src/models/Submission.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Submission = sequelize.define('Submission', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    taskId: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    phoneNumber: DataTypes.STRING(255), // 加密
    screenshotSearch: DataTypes.STRING(500),
    screenshotShop1: DataTypes.STRING(500),
    screenshotShop2: DataTypes.STRING(500),
    screenshotShop3: DataTypes.STRING(500),
    screenshotFollow: DataTypes.STRING(500),
    screenshotShare: DataTypes.STRING(500),
    screenshotDetail: DataTypes.STRING(500),
    screenshotCart: DataTypes.STRING(500),
    status: {
      type: DataTypes.TINYINT,
      defaultValue: 0 // 0待审核 1通过 2拒绝
    },
    rejectReason: DataTypes.STRING(500),
    rewardAmount: DataTypes.DECIMAL(10, 2),
    reviewedAt: DataTypes.DATE
  }, {
    tableName: 'submissions',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['task_id', 'user_id']
      }
    ]
  });

  return Submission;
};
```

### 2. 认证中间件

```javascript
// src/middlewares/auth.js
const jwt = require('jsonwebtoken');
const { User, Merchant } = require('../models');
const { JWT_SECRET } = require('../config/jwt');

// 用户认证
exports.authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        code: 1002,
        message: '未登录'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'user') {
      return res.status(403).json({
        code: 1003,
        message: '无权限'
      });
    }

    const user = await User.findByPk(decoded.user_id);

    if (!user || user.status !== 1) {
      return res.status(401).json({
        code: 2001,
        message: '用户不存在或已被禁用'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      code: 1002,
      message: 'Token无效或已过期'
    });
  }
};

// 商家认证
exports.authenticateMerchant = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        code: 1002,
        message: '未登录'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'merchant') {
      return res.status(403).json({
        code: 1003,
        message: '无权限'
      });
    }

    const merchant = await Merchant.findByPk(decoded.user_id);

    if (!merchant || merchant.status !== 1) {
      return res.status(401).json({
        code: 2001,
        message: '商家不存在或已被禁用'
      });
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    return res.status(401).json({
      code: 1002,
      message: 'Token无效或已过期'
    });
  }
};
```

### 3. 微信登录服务

```javascript
// src/services/wechat.service.js
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { JWT_SECRET } = require('../config/jwt');

const WECHAT_APPID = process.env.WECHAT_APPID;
const WECHAT_SECRET = process.env.WECHAT_SECRET;

class WechatService {
  // 微信登录
  async login(code) {
    // 1. 通过code换取openid
    const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: WECHAT_APPID,
        secret: WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    if (data.errcode) {
      throw new Error(data.errmsg);
    }

    const { openid, unionid, session_key } = data;

    // 2. 查找或创建用户
    let user = await User.findOne({ where: { openid } });

    if (!user) {
      user = await User.create({
        openid,
        unionid
      });
    }

    // 3. 生成JWT token
    const token = jwt.sign(
      {
        user_id: user.id,
        type: 'user'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        totalEarnings: user.totalEarnings,
        availableBalance: user.availableBalance
      }
    };
  }
}

module.exports = new WechatService();
```

### 4. 任务提交服务

```javascript
// src/services/task.service.js
const { Task, Submission, User, Earning } = require('../models');
const { sequelize } = require('../models');
const crypto = require('../utils/crypto');

class TaskService {
  // 提交任务
  async submitTask(userId, data) {
    const transaction = await sequelize.transaction();

    try {
      // 1. 检查任务是否存在且有效
      const task = await Task.findByPk(data.task_id);

      if (!task) {
        throw new Error('任务不存在');
      }

      if (task.status !== 1) {
        throw new Error('任务已结束');
      }

      if (task.remainingQuota <= 0) {
        throw new Error('名额已满');
      }

      // 2. 检查是否已提交过
      const existingSubmission = await Submission.findOne({
        where: {
          taskId: data.task_id,
          userId: userId
        }
      });

      if (existingSubmission) {
        throw new Error('已提交过该任务');
      }

      // 3. 加密手机号
      const encryptedPhone = crypto.encrypt(data.phone_number);

      // 4. 创建提交记录
      const submission = await Submission.create({
        taskId: data.task_id,
        userId: userId,
        phoneNumber: encryptedPhone,
        screenshotSearch: data.screenshot_search,
        screenshotShop1: data.screenshot_shop_1,
        screenshotShop2: data.screenshot_shop_2,
        screenshotShop3: data.screenshot_shop_3,
        screenshotFollow: data.screenshot_follow,
        screenshotShare: data.screenshot_share,
        screenshotDetail: data.screenshot_detail,
        screenshotCart: data.screenshot_cart,
        rewardAmount: task.rewardAmount,
        status: 0 // 待审核
      }, { transaction });

      // 5. 减少任务剩余名额
      await task.decrement('remainingQuota', { transaction });

      await transaction.commit();

      return {
        submission_id: submission.id
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // 审核任务提交
  async reviewSubmission(merchantId, submissionId, status, rejectReason) {
    const transaction = await sequelize.transaction();

    try {
      // 1. 查找提交记录
      const submission = await Submission.findByPk(submissionId, {
        include: [
          { model: Task, as: 'task' },
          { model: User, as: 'user' }
        ]
      });

      if (!submission) {
        throw new Error('提交记录不存在');
      }

      // 2. 验证商家权限
      if (submission.task.merchantId !== merchantId) {
        throw new Error('无权限审核');
      }

      if (submission.status !== 0) {
        throw new Error('该提交已审核');
      }

      // 3. 更新提交状态
      submission.status = status;
      submission.rejectReason = rejectReason;
      submission.reviewedAt = new Date();
      await submission.save({ transaction });

      // 4. 如果通过，发放奖励
      if (status === 1) {
        const user = submission.user;
        const rewardAmount = submission.rewardAmount;

        // 更新用户余额
        await user.increment({
          totalEarnings: rewardAmount,
          availableBalance: rewardAmount
        }, { transaction });

        // 创建收益记录
        await Earning.create({
          userId: user.id,
          submissionId: submission.id,
          type: 1, // 任务奖励
          amount: rewardAmount,
          balanceAfter: parseFloat(user.availableBalance) + parseFloat(rewardAmount),
          description: `任务奖励：${submission.task.title}`
        }, { transaction });
      } else if (status === 2) {
        // 如果拒绝，恢复任务名额
        await submission.task.increment('remainingQuota', { transaction });
      }

      await transaction.commit();

      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new TaskService();
```

### 5. 文件上传服务

```javascript
// src/services/oss.service.js
const OSS = require('ali-oss');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const client = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
});

class OSSService {
  // 上传图片
  async uploadImage(file) {
    try {
      const ext = path.extname(file.originalname);
      const filename = `${uuidv4()}${ext}`;
      const objectName = `uploads/${new Date().toISOString().split('T')[0]}/${filename}`;

      const result = await client.put(objectName, file.path);

      return {
        url: result.url
      };
    } catch (error) {
      throw new Error('图片上传失败');
    }
  }
}

module.exports = new OSSService();
```

### 6. 限流中间件

```javascript
// src/middlewares/rateLimit.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../config/redis');

// API限流
exports.apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate_limit:'
  }),
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试'
  }
});

// 提交任务限流
exports.submitLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'submit_limit:'
  }),
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 最多5次提交
  message: {
    code: 429,
    message: '提交过于频繁，请稍后再试'
  }
});
```

### 7. 错误处理中间件

```javascript
// src/middlewares/errorHandler.js
const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  logger.error(err.stack);

  // Sequelize 验证错误
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      code: 1001,
      message: '参数验证失败',
      errors: err.errors.map(e => e.message)
    });
  }

  // Sequelize 唯一约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      code: 1001,
      message: '数据已存在'
    });
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      code: 1002,
      message: 'Token无效'
    });
  }

  // 默认错误
  res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误'
  });
};
```

---

## 环境配置

### .env 文件
```env
# 服务器配置
NODE_ENV=development
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=task_reward
DB_USER=root
DB_PASSWORD=password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your_jwt_secret_key

# 微信小程序配置
WECHAT_APPID=your_appid
WECHAT_SECRET=your_secret

# 阿里云OSS配置
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name

# 加密密钥
CRYPTO_KEY=your_32_char_encryption_key
CRYPTO_IV=your_16_char_iv
```

---

## 启动脚本

### package.json
```json
{
  "name": "task-reward-backend",
  "version": "1.0.0",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "test": "jest",
    "migrate": "sequelize-cli db:migrate",
    "seed": "sequelize-cli db:seed:all"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sequelize": "^6.35.0",
    "mysql2": "^3.6.5",
    "redis": "^4.6.0",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "multer": "^1.4.5-lts.1",
    "ali-oss": "^6.18.0",
    "axios": "^1.6.2",
    "joi": "^17.11.0",
    "winston": "^3.11.0",
    "express-rate-limit": "^7.1.5",
    "rate-limit-redis": "^4.2.0",
    "bull": "^4.12.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "jest": "^29.7.0",
    "sequelize-cli": "^6.6.2"
  }
}
```

---

## 部署清单

### 1. 服务器要求
- CPU: 2核+
- 内存: 4GB+
- 硬盘: 50GB+
- 系统: Ubuntu 20.04 LTS

### 2. 软件安装
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MySQL
sudo apt-get install mysql-server

# Redis
sudo apt-get install redis-server

# Nginx
sudo apt-get install nginx

# PM2
npm install -g pm2
```

### 3. 部署步骤
```bash
# 1. 克隆代码
git clone <repository>
cd task-reward-backend

# 2. 安装依赖
npm install --production

# 3. 配置环境变量
cp .env.example .env
vim .env

# 4. 数据库迁移
npm run migrate

# 5. 启动应用
pm2 start src/app.js --name task-reward-api

# 6. 配置开机自启
pm2 startup
pm2 save
```

### 4. Nginx 配置
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
