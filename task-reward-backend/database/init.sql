-- Task Reward platform database initialization

CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(64) UNIQUE NOT NULL COMMENT 'WeChat openid',
  unionid VARCHAR(64) DEFAULT NULL COMMENT 'WeChat unionid',
  nickname VARCHAR(100) DEFAULT NULL COMMENT 'Nickname',
  avatar VARCHAR(255) DEFAULT NULL COMMENT 'Avatar URL',
  phone VARCHAR(255) DEFAULT NULL COMMENT 'Encrypted phone number',
  total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Total earnings',
  available_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Available balance',
  frozen_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Frozen balance',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1 active, 2 disabled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid),
  INDEX idx_phone (phone(20))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Users';

CREATE TABLE IF NOT EXISTS user_identity_links (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT 'User ID',
  identity_type VARCHAR(32) NOT NULL COMMENT 'Identity type',
  identity_hash VARCHAR(128) NOT NULL COMMENT 'Identity hash',
  identity_value VARCHAR(255) DEFAULT NULL COMMENT 'Masked identity value',
  source VARCHAR(32) DEFAULT NULL COMMENT 'Source channel',
  source_ref VARCHAR(255) DEFAULT NULL COMMENT 'Source reference',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_identity (identity_type, identity_hash),
  INDEX idx_user_id (user_id),
  INDEX idx_identity_type (identity_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User identity links';

CREATE TABLE IF NOT EXISTS user_risk_flags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT 'User ID',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1 blocked, 0 normal',
  risk_reason VARCHAR(500) NOT NULL COMMENT 'Risk reason',
  risk_tags JSON DEFAULT NULL COMMENT 'Risk tags',
  source VARCHAR(32) DEFAULT NULL COMMENT 'Source channel',
  blocked_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Blocked time',
  cleared_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Cleared time',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_blocked_at (blocked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User risk flags';

CREATE TABLE IF NOT EXISTS user_platform_cooldowns (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT 'User ID',
  platform VARCHAR(32) NOT NULL COMMENT 'Platform',
  last_submission_id BIGINT DEFAULT NULL COMMENT 'Last submission ID',
  last_submission_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Last submission time',
  cooldown_until TIMESTAMP NULL DEFAULT NULL COMMENT 'Cooldown until',
  cooldown_months INT NOT NULL DEFAULT 3 COMMENT 'Cooldown months',
  reason VARCHAR(500) DEFAULT NULL COMMENT 'Cooldown reason',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_platform (user_id, platform),
  INDEX idx_cooldown_until (cooldown_until),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User platform cooldowns';

CREATE TABLE IF NOT EXISTS merchants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL COMMENT 'Login username',
  password VARCHAR(255) NOT NULL COMMENT 'Bcrypt password hash',
  company_name VARCHAR(200) DEFAULT NULL COMMENT 'Company name',
  contact_name VARCHAR(50) DEFAULT NULL COMMENT 'Contact name',
  contact_phone VARCHAR(20) DEFAULT NULL COMMENT 'Contact phone',
  email VARCHAR(100) DEFAULT NULL COMMENT 'Email',
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Merchant balance',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1 active, 2 disabled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Merchants';

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  merchant_id BIGINT NOT NULL COMMENT 'Merchant ID',
  platform VARCHAR(32) NOT NULL COMMENT 'Platform',
  title VARCHAR(200) NOT NULL COMMENT 'Task title',
  description TEXT DEFAULT NULL COMMENT 'Task description',
  reward_amount DECIMAL(10,2) NOT NULL COMMENT 'Reward per submission',
  total_quota INT NOT NULL COMMENT 'Total quota',
  remaining_quota INT NOT NULL COMMENT 'Remaining quota',
  search_keyword VARCHAR(100) DEFAULT NULL COMMENT 'Search keyword',
  shop_name VARCHAR(200) DEFAULT NULL COMMENT 'Shop name',
  product_link VARCHAR(500) DEFAULT NULL COMMENT 'Product link',
  requirements JSON DEFAULT NULL COMMENT 'Task requirements',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1 active, 2 paused, 3 closed',
  start_time TIMESTAMP NULL DEFAULT NULL COMMENT 'Start time',
  end_time TIMESTAMP NULL DEFAULT NULL COMMENT 'End time',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_merchant_id (merchant_id),
  INDEX idx_status (status),
  INDEX idx_start_time (start_time),
  CONSTRAINT fk_tasks_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Tasks';

CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT NOT NULL COMMENT 'Task ID',
  user_id BIGINT NOT NULL COMMENT 'User ID',
  platform VARCHAR(32) NOT NULL COMMENT 'Platform',
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Actual paid amount',
  phone_number VARCHAR(255) DEFAULT NULL COMMENT 'Encrypted phone number',
  screenshot_search VARCHAR(500) DEFAULT NULL,
  screenshot_shop_1 VARCHAR(500) DEFAULT NULL,
  screenshot_shop_2 VARCHAR(500) DEFAULT NULL,
  screenshot_shop_3 VARCHAR(500) DEFAULT NULL,
  screenshot_follow VARCHAR(500) DEFAULT NULL,
  screenshot_share VARCHAR(500) DEFAULT NULL,
  screenshot_detail VARCHAR(500) DEFAULT NULL,
  screenshot_cart VARCHAR(500) DEFAULT NULL,
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0 pending, 1 approved, 2 rejected',
  reject_reason VARCHAR(500) DEFAULT NULL,
  reward_amount DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Reward amount',
  reviewed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Review time',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_task_user (task_id, user_id),
  INDEX idx_task_id (task_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_submissions_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  CONSTRAINT fk_submissions_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Submissions';

CREATE TABLE IF NOT EXISTS earnings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT 'User ID',
  submission_id BIGINT DEFAULT NULL COMMENT 'Submission ID',
  type TINYINT NOT NULL COMMENT '1 task reward, 2 withdrawal, 3 refund',
  amount DECIMAL(10,2) NOT NULL COMMENT 'Amount',
  balance_after DECIMAL(10,2) NOT NULL COMMENT 'Balance after operation',
  description VARCHAR(200) DEFAULT NULL COMMENT 'Description',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at),
  CONSTRAINT fk_earnings_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_earnings_submission FOREIGN KEY (submission_id) REFERENCES submissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Earnings';

CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT 'User ID',
  amount DECIMAL(10,2) NOT NULL COMMENT 'Withdrawal amount',
  fee DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Fee',
  actual_amount DECIMAL(10,2) NOT NULL COMMENT 'Net amount',
  withdraw_type TINYINT NOT NULL DEFAULT 1 COMMENT '1 WeChat, 2 Alipay',
  account_info VARCHAR(500) DEFAULT NULL COMMENT 'Encrypted account info',
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0 pending, 1 processed, 2 rejected',
  reject_reason VARCHAR(200) DEFAULT NULL,
  processed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Processed time',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  CONSTRAINT fk_withdrawals_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Withdrawals';

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  operator_type VARCHAR(20) NOT NULL COMMENT 'Operator type',
  operator_id BIGINT NOT NULL COMMENT 'Operator ID',
  action VARCHAR(50) NOT NULL COMMENT 'Action',
  target_type VARCHAR(20) NOT NULL COMMENT 'Target type',
  target_id BIGINT NOT NULL COMMENT 'Target ID',
  summary VARCHAR(255) DEFAULT NULL COMMENT 'Summary',
  detail JSON DEFAULT NULL COMMENT 'Detail',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operator_id (operator_id),
  INDEX idx_target_type (target_type),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Audit logs';

CREATE TABLE IF NOT EXISTS merchant_recharges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  merchant_id BIGINT NOT NULL COMMENT 'Merchant ID',
  amount DECIMAL(10,2) NOT NULL COMMENT 'Recharge amount',
  payment_method TINYINT DEFAULT NULL COMMENT '1 Alipay, 2 WeChat, 3 bank transfer',
  transaction_no VARCHAR(100) DEFAULT NULL COMMENT 'Transaction number',
  status TINYINT NOT NULL DEFAULT 0 COMMENT '0 pending, 1 completed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_merchant_id (merchant_id),
  CONSTRAINT fk_recharges_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Merchant recharges';

CREATE TABLE IF NOT EXISTS system_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(50) UNIQUE NOT NULL COMMENT 'Config key',
  config_value TEXT DEFAULT NULL COMMENT 'Config value',
  description VARCHAR(200) DEFAULT NULL COMMENT 'Description',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='System config';

CREATE TABLE IF NOT EXISTS login_attempts (
  login_key VARCHAR(128) PRIMARY KEY COMMENT 'Login key',
  count INT NOT NULL DEFAULT 0 COMMENT 'Failure count',
  locked_until TIMESTAMP NULL DEFAULT NULL COMMENT 'Locked until',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_locked_until (locked_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Login attempts';

INSERT INTO system_config (config_key, config_value, description) VALUES
('min_withdrawal_amount', '10.00', 'Minimum withdrawal amount'),
('withdrawal_fee_rate', '0.01', 'Withdrawal fee rate'),
('platform_commission_rate', '0.10', 'Platform commission rate'),
('task_review_timeout', '24', 'Task review timeout in hours')
ON DUPLICATE KEY UPDATE
  config_value = VALUES(config_value),
  description = VALUES(description);

INSERT INTO merchants (username, password, company_name, contact_phone, balance, status)
VALUES ('admin', '$2a$10$1zmgkT7R2lC3QLkmKK41x.I5JIY5rtlSNcNWSf1mzrtlC9AiCDlIa', 'Demo merchant', '13800138000', 10000.00, 1)
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  company_name = VALUES(company_name),
  contact_phone = VALUES(contact_phone),
  balance = VALUES(balance),
  status = VALUES(status);
