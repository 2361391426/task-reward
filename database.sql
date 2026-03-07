-- 任务返现小程序数据库设计

-- 用户表
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(100) UNIQUE COMMENT '微信openid',
  unionid VARCHAR(100) COMMENT '微信unionid',
  nickname VARCHAR(100) COMMENT '昵称',
  avatar VARCHAR(500) COMMENT '头像',
  phone VARCHAR(20) COMMENT '手机号',
  total_earnings DECIMAL(10,2) DEFAULT 0 COMMENT '累计收益',
  status TINYINT DEFAULT 1 COMMENT '1-正常 2-禁用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_openid (openid),
  INDEX idx_phone (phone)
) COMMENT '用户表';

-- 任务表
CREATE TABLE tasks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL COMMENT '任务标题',
  reward_amount DECIMAL(10,2) NOT NULL COMMENT '返现金额',
  search_keyword VARCHAR(100) COMMENT '搜索关键词',
  shop_name VARCHAR(200) COMMENT '店铺名称',
  product_name VARCHAR(200) COMMENT '商品名称',
  product_url TEXT COMMENT '商品链接',
  requirements JSON COMMENT '任务要求详情',
  total_quota INT DEFAULT 0 COMMENT '任务总名额',
  used_quota INT DEFAULT 0 COMMENT '已使用名额',
  status TINYINT DEFAULT 1 COMMENT '1-进行中 2-已暂停 3-已结束',
  start_time DATETIME COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status, end_time),
  INDEX idx_created (created_at)
) COMMENT '任务表';

-- 用户提交记录表
CREATE TABLE submissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  task_id BIGINT NOT NULL COMMENT '任务ID',
  
  -- 8张截图URL
  screenshot_search VARCHAR(500) COMMENT '搜索关键词截图',
  screenshot_shop_1 VARCHAR(500) COMMENT '浏览店铺截图1',
  screenshot_shop_2 VARCHAR(500) COMMENT '浏览店铺截图2',
  screenshot_shop_3 VARCHAR(500) COMMENT '浏览店铺截图3',
  screenshot_follow VARCHAR(500) COMMENT '主图点关注评论截图',
  screenshot_share VARCHAR(500) COMMENT '分享截图',
  screenshot_detail VARCHAR(500) COMMENT '商品详情页浏览截图',
  screenshot_cart VARCHAR(500) COMMENT '商品加购截图',
  
  phone_number VARCHAR(100) COMMENT '手机号（加密存储）',
  submit_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
  
  review_status TINYINT DEFAULT 0 COMMENT '0-待审核 1-审核通过 2-审核驳回',
  review_time DATETIME COMMENT '审核时间',
  reviewer_id BIGINT COMMENT '审核人ID',
  review_note VARCHAR(500) COMMENT '审核备注/驳回原因',
  
  reward_status TINYINT DEFAULT 0 COMMENT '0-未发放 1-已发放 2-发放失败',
  reward_time DATETIME COMMENT '返现时间',
  reward_amount DECIMAL(10,2) COMMENT '实际返现金额',
  
  ip_address VARCHAR(50) COMMENT 'IP地址',
  device_info VARCHAR(200) COMMENT '设备信息',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_task (user_id, task_id),
  INDEX idx_review_status (review_status, submit_time),
  INDEX idx_task_status (task_id, review_status),
  INDEX idx_user_status (user_id, review_status),
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
) COMMENT '用户提交记录表';

-- 商家管理员表
CREATE TABLE admins (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(200) NOT NULL COMMENT '密码（bcrypt加密）',
  nickname VARCHAR(100),
  email VARCHAR(100),
  role TINYINT DEFAULT 1 COMMENT '1-普通管理员 2-超级管理员',
  status TINYINT DEFAULT 1 COMMENT '1-正常 2-禁用',
  last_login_time DATETIME COMMENT '最后登录时间',
  last_login_ip VARCHAR(50) COMMENT '最后登录IP',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username)
) COMMENT '商家管理员表';

-- 返现记录表
CREATE TABLE reward_records (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  submission_id BIGINT NOT NULL COMMENT '提交记录ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  task_id BIGINT NOT NULL COMMENT '任务ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '返现金额',
  status TINYINT DEFAULT 0 COMMENT '0-待发放 1-已发放 2-发放失败',
  payment_method VARCHAR(50) COMMENT '支付方式',
  transaction_id VARCHAR(100) COMMENT '交易单号',
  error_message TEXT COMMENT '失败原因',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_submission (submission_id),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
) COMMENT '返现记录表';

-- 操作日志表
CREATE TABLE operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  admin_id BIGINT COMMENT '管理员ID',
  operation_type VARCHAR(50) COMMENT '操作类型',
  operation_desc TEXT COMMENT '操作描述',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin (admin_id),
  INDEX idx_created (created_at)
) COMMENT '操作日志表';

-- 插入默认管理员账号（密码: admin123）
INSERT INTO admins (username, password, nickname, role) VALUES 
('admin', '$2b$10$YourHashedPasswordHere', '超级管理员', 2);
