-- 任务返现平台数据库初始化脚本

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) UNIQUE NOT NULL COMMENT '微信openid',
  unionid VARCHAR(64) COMMENT '微信unionid',
  nickname VARCHAR(100) COMMENT '昵称',
  avatar VARCHAR(255) COMMENT '头像URL',
  phone VARCHAR(255) COMMENT '手机号（加密存储）',
  total_earnings DECIMAL(10,2) DEFAULT 0.00 COMMENT '累计收益',
  available_balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '可提现余额',
  frozen_balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '冻结金额',
  status TINYINT DEFAULT 1 COMMENT '状态：1正常 2禁用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid),
  INDEX idx_phone (phone(20))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 2. 商家表
CREATE TABLE IF NOT EXISTS merchants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT '登录账号',
  password VARCHAR(255) NOT NULL COMMENT '密码（bcrypt加密）',
  company_name VARCHAR(200) COMMENT '公司名称',
  contact_name VARCHAR(50) COMMENT '联系人',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  email VARCHAR(100) COMMENT '邮箱',
  balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '账户余额',
  status TINYINT DEFAULT 1 COMMENT '状态：1正常 2禁用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商家表';

-- 3. 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  merchant_id BIGINT NOT NULL COMMENT '商家ID',
  title VARCHAR(200) NOT NULL COMMENT '任务标题',
  description TEXT COMMENT '任务描述',
  reward_amount DECIMAL(10,2) NOT NULL COMMENT '单次奖励金额',
  total_quota INT NOT NULL COMMENT '总名额',
  remaining_quota INT NOT NULL COMMENT '剩余名额',
  search_keyword VARCHAR(100) COMMENT '搜索关键词',
  shop_name VARCHAR(200) COMMENT '店铺名称',
  product_link VARCHAR(500) COMMENT '商品链接',
  requirements JSON COMMENT '任务要求',
  status TINYINT DEFAULT 1 COMMENT '状态：1进行中 2已暂停 3已结束',
  start_time TIMESTAMP NULL COMMENT '开始时间',
  end_time TIMESTAMP NULL COMMENT '结束时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_merchant_id (merchant_id),
  INDEX idx_status (status),
  INDEX idx_start_time (start_time),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务表';

-- 4. 任务提交记录表
CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT NOT NULL COMMENT '任务ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  phone_number VARCHAR(255) COMMENT '手机号（加密）',
  screenshot_search VARCHAR(500) COMMENT '搜索截图URL',
  screenshot_shop_1 VARCHAR(500) COMMENT '店铺浏览截图1',
  screenshot_shop_2 VARCHAR(500) COMMENT '店铺浏览截图2',
  screenshot_shop_3 VARCHAR(500) COMMENT '店铺浏览截图3',
  screenshot_follow VARCHAR(500) COMMENT '关注评论截图',
  screenshot_share VARCHAR(500) COMMENT '分享截图',
  screenshot_detail VARCHAR(500) COMMENT '详情页截图',
  screenshot_cart VARCHAR(500) COMMENT '加购截图',
  status TINYINT DEFAULT 0 COMMENT '状态：0待审核 1已通过 2已拒绝',
  reject_reason VARCHAR(500) COMMENT '拒绝原因',
  reward_amount DECIMAL(10,2) COMMENT '奖励金额',
  reviewed_at TIMESTAMP NULL COMMENT '审核时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  UNIQUE KEY uk_task_user (task_id, user_id) COMMENT '同一用户同一任务只能提交一次',
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务提交记录表';

-- 5. 收益记录表
CREATE TABLE IF NOT EXISTS earnings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  submission_id BIGINT COMMENT '提交记录ID',
  type TINYINT NOT NULL COMMENT '类型：1任务奖励 2提现 3退款',
  amount DECIMAL(10,2) NOT NULL COMMENT '金额',
  balance_after DECIMAL(10,2) NOT NULL COMMENT '操作后余额',
  description VARCHAR(200) COMMENT '说明',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收益记录表';

-- 6. 提现记录表
CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '提现金额',
  fee DECIMAL(10,2) DEFAULT 0.00 COMMENT '手续费',
  actual_amount DECIMAL(10,2) NOT NULL COMMENT '实际到账金额',
  withdraw_type TINYINT DEFAULT 1 COMMENT '提现方式：1微信 2支付宝',
  account_info VARCHAR(500) COMMENT '账户信息（加密）',
  status TINYINT DEFAULT 0 COMMENT '状态：0待处理 1已完成 2已拒绝',
  reject_reason VARCHAR(200) COMMENT '拒绝原因',
  processed_at TIMESTAMP NULL COMMENT '处理时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='提现记录表';

-- 7. 商家充值记录表
CREATE TABLE IF NOT EXISTS merchant_recharges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  merchant_id BIGINT NOT NULL COMMENT '商家ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '充值金额',
  payment_method TINYINT COMMENT '支付方式：1支付宝 2微信 3银行转账',
  transaction_no VARCHAR(100) COMMENT '交易流水号',
  status TINYINT DEFAULT 0 COMMENT '状态：0待确认 1已完成',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_merchant_id (merchant_id),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商家充值记录表';

-- 8. 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL COMMENT '配置键',
  config_value TEXT COMMENT '配置值',
  description VARCHAR(200) COMMENT '说明',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 插入初始配置
INSERT INTO system_config (config_key, config_value, description) VALUES
('min_withdrawal_amount', '10.00', '最低提现金额'),
('withdrawal_fee_rate', '0.01', '提现手续费率'),
('platform_commission_rate', '0.10', '平台抽成比例'),
('task_review_timeout', '24', '任务审核超时时间（小时）')
ON DUPLICATE KEY UPDATE config_value = VALUES(config_value);

-- 插入测试商家账号（密码: admin123）
INSERT INTO merchants (username, password, company_name, balance, status)
VALUES ('admin', '$2b$10$rKvVJKxZ5yJxH5yJxH5yJOqKvVJKxZ5yJxH5yJxH5yJxH5yJxH5yJ', '测试商家', 10000.00, 1)
ON DUPLICATE KEY UPDATE username = VALUES(username);
