const ensureColumn = async (connection, tableName, columnName, definition) => {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  )

  if (rows.length === 0) {
    await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definition}`)
  }
}

const ensureIndex = async (connection, tableName, indexName, definitionSql) => {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  )

  if (rows.length === 0) {
    await connection.query(`ALTER TABLE \`${tableName}\` ADD ${definitionSql}`)
  }
}

module.exports = {
  name: '001_current_schema',
  up: async (connection) => {
    await ensureColumn(connection, 'users', 'unionid', '`unionid` VARCHAR(64) DEFAULT NULL COMMENT \'WeChat unionid\'')
    await ensureColumn(connection, 'users', 'avatar', '`avatar` VARCHAR(255) DEFAULT NULL COMMENT \'Avatar URL\'')
    await ensureColumn(connection, 'users', 'phone', '`phone` VARCHAR(255) DEFAULT NULL COMMENT \'Encrypted phone number\'')
    await ensureColumn(connection, 'users', 'total_earnings', '`total_earnings` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT \'Total earnings\'')
    await ensureColumn(connection, 'users', 'available_balance', '`available_balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT \'Available balance\'')
    await ensureColumn(connection, 'users', 'frozen_balance', '`frozen_balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT \'Frozen balance\'')
    await ensureColumn(connection, 'users', 'status', '`status` TINYINT NOT NULL DEFAULT 1 COMMENT \'1 active, 2 disabled\'')

    await ensureColumn(connection, 'merchants', 'company_name', '`company_name` VARCHAR(200) DEFAULT NULL COMMENT \'Company name\'')
    await ensureColumn(connection, 'merchants', 'contact_name', '`contact_name` VARCHAR(50) DEFAULT NULL COMMENT \'Contact name\'')
    await ensureColumn(connection, 'merchants', 'contact_phone', '`contact_phone` VARCHAR(20) DEFAULT NULL COMMENT \'Contact phone\'')
    await ensureColumn(connection, 'merchants', 'email', '`email` VARCHAR(100) DEFAULT NULL COMMENT \'Email\'')
    await ensureColumn(connection, 'merchants', 'balance', '`balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT \'Merchant balance\'')
    await ensureColumn(connection, 'merchants', 'status', '`status` TINYINT NOT NULL DEFAULT 1 COMMENT \'1 active, 2 disabled\'')

    await ensureColumn(connection, 'tasks', 'merchant_id', '`merchant_id` BIGINT NOT NULL DEFAULT 1 COMMENT \'Merchant ID\'')
    await ensureColumn(connection, 'tasks', 'platform', '`platform` VARCHAR(32) NOT NULL DEFAULT \'taobao\' COMMENT \'Platform\'')
    await ensureColumn(connection, 'tasks', 'description', '`description` TEXT DEFAULT NULL COMMENT \'Task description\'')
    await ensureColumn(connection, 'tasks', 'reward_amount', '`reward_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT \'Reward per submission\'')
    await ensureColumn(connection, 'tasks', 'total_quota', '`total_quota` INT NOT NULL DEFAULT 0 COMMENT \'Total quota\'')
    await ensureColumn(connection, 'tasks', 'remaining_quota', '`remaining_quota` INT NOT NULL DEFAULT 0 COMMENT \'Remaining quota\'')
    await ensureColumn(connection, 'tasks', 'search_keyword', '`search_keyword` VARCHAR(100) DEFAULT NULL COMMENT \'Search keyword\'')
    await ensureColumn(connection, 'tasks', 'shop_name', '`shop_name` VARCHAR(200) DEFAULT NULL COMMENT \'Shop name\'')
    await ensureColumn(connection, 'tasks', 'product_name', '`product_name` VARCHAR(200) DEFAULT NULL COMMENT \'Product name\'')
    await ensureColumn(connection, 'tasks', 'product_link', '`product_link` VARCHAR(500) DEFAULT NULL COMMENT \'Product link\'')
    await ensureColumn(connection, 'tasks', 'requirements', '`requirements` JSON DEFAULT NULL COMMENT \'Task requirements\'')
    await ensureColumn(connection, 'tasks', 'status', '`status` TINYINT NOT NULL DEFAULT 1 COMMENT \'1 active, 2 paused, 3 closed\'')
    await ensureColumn(connection, 'tasks', 'start_time', '`start_time` TIMESTAMP NULL DEFAULT NULL COMMENT \'Start time\'')
    await ensureColumn(connection, 'tasks', 'accept_start_time', '`accept_start_time` TIMESTAMP NULL DEFAULT NULL COMMENT \'Accept start time\'')
    await ensureColumn(connection, 'tasks', 'end_time', '`end_time` TIMESTAMP NULL DEFAULT NULL COMMENT \'End time\'')

    await ensureIndex(connection, 'tasks', 'idx_merchant_id', 'INDEX `idx_merchant_id` (`merchant_id`)')
    await ensureIndex(connection, 'tasks', 'idx_status', 'INDEX `idx_status` (`status`)')
    await ensureIndex(connection, 'tasks', 'idx_start_time', 'INDEX `idx_start_time` (`start_time`)')
    await ensureIndex(connection, 'tasks', 'idx_accept_start_time', 'INDEX `idx_accept_start_time` (`accept_start_time`)')
    await ensureIndex(connection, 'tasks', 'idx_status_end_time', 'INDEX `idx_status_end_time` (`status`, `end_time`)')
    await ensureIndex(connection, 'tasks', 'idx_merchant_status_created_at', 'INDEX `idx_merchant_status_created_at` (`merchant_id`, `status`, `created_at`)')

    await ensureColumn(connection, 'submissions', 'platform', '`platform` VARCHAR(32) NOT NULL DEFAULT \'taobao\' COMMENT \'Platform\'')
    await ensureColumn(connection, 'submissions', 'paid_amount', '`paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT \'Actual paid amount\'')
    await ensureColumn(connection, 'submissions', 'wechat_id', '`wechat_id` VARCHAR(100) DEFAULT NULL COMMENT \'WeChat ID\'')
    await ensureColumn(connection, 'submissions', 'screenshot_paid_order', '`screenshot_paid_order` VARCHAR(500) DEFAULT NULL')
    await ensureColumn(connection, 'submissions', 'order_number', '`order_number` VARCHAR(100) DEFAULT NULL COMMENT \'Order number\'')
    await ensureColumn(connection, 'submissions', 'address_text', '`address_text` TEXT DEFAULT NULL COMMENT \'Address text\'')
    await ensureColumn(connection, 'submissions', 'status', '`status` TINYINT NOT NULL DEFAULT 0 COMMENT \'0 pending, 1 approved, 2 rejected\'')
    await ensureColumn(connection, 'submissions', 'reject_reason', '`reject_reason` VARCHAR(500) DEFAULT NULL')
    await ensureColumn(connection, 'submissions', 'reward_amount', '`reward_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT \'Reward amount\'')
    await ensureColumn(connection, 'submissions', 'reviewed_at', '`reviewed_at` TIMESTAMP NULL DEFAULT NULL COMMENT \'Review time\'')

    await ensureIndex(connection, 'submissions', 'idx_task_id', 'INDEX `idx_task_id` (`task_id`)')
    await ensureIndex(connection, 'submissions', 'idx_user_id', 'INDEX `idx_user_id` (`user_id`)')
    await ensureIndex(connection, 'submissions', 'idx_status', 'INDEX `idx_status` (`status`)')
    await ensureIndex(connection, 'submissions', 'idx_created_at', 'INDEX `idx_created_at` (`created_at`)')
    await ensureIndex(connection, 'submissions', 'idx_task_status_created_at', 'INDEX `idx_task_status_created_at` (`task_id`, `status`, `created_at`)')
    await ensureIndex(connection, 'submissions', 'idx_user_status_created_at', 'INDEX `idx_user_status_created_at` (`user_id`, `status`, `created_at`)')

    await ensureTable(connection, 'feedbacks', `
      CREATE TABLE IF NOT EXISTS feedbacks (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id BIGINT NOT NULL COMMENT 'User ID',
        user_nickname VARCHAR(100) DEFAULT NULL COMMENT 'User nickname',
        user_avatar VARCHAR(255) DEFAULT NULL COMMENT 'User avatar',
        category VARCHAR(50) NOT NULL DEFAULT 'general' COMMENT 'Feedback category',
        content TEXT NOT NULL COMMENT 'Feedback content',
        contact_info VARCHAR(200) DEFAULT NULL COMMENT 'Contact info',
        attachments JSON DEFAULT NULL COMMENT 'Attachment list',
        task_id BIGINT DEFAULT NULL COMMENT 'Related task ID',
        status TINYINT NOT NULL DEFAULT 0 COMMENT '0 pending, 1 replied, 2 closed',
        reply_content TEXT DEFAULT NULL COMMENT 'Merchant reply',
        reply_user_type VARCHAR(20) DEFAULT NULL COMMENT 'Reply user type',
        reply_user_id BIGINT DEFAULT NULL COMMENT 'Reply user ID',
        reply_user_name VARCHAR(100) DEFAULT NULL COMMENT 'Reply user name',
        replied_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Replied time',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX `idx_user_id` (`user_id`),
        INDEX `idx_status` (`status`),
        INDEX `idx_created_at` (`created_at`),
        INDEX `idx_task_id` (`task_id`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='User feedbacks'
    `)
  }
}
