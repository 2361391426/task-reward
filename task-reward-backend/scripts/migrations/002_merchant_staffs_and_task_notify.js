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
  name: '002_merchant_staffs_and_task_notify',
  up: async (connection) => {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS merchant_staffs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        merchant_id BIGINT NOT NULL COMMENT 'Merchant ID',
        username VARCHAR(50) NOT NULL COMMENT 'Login username',
        password VARCHAR(255) NOT NULL COMMENT 'Bcrypt password hash',
        nickname VARCHAR(100) DEFAULT NULL COMMENT 'Display name',
        role VARCHAR(20) NOT NULL DEFAULT 'operator' COMMENT 'operator, reviewer, finance',
        status TINYINT NOT NULL DEFAULT 1 COMMENT '1 active, 2 disabled',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_merchant_username (merchant_id, username),
        INDEX idx_merchant_id (merchant_id),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    )

    await ensureColumn(connection, 'tasks', 'start_notified_at', '`start_notified_at` TIMESTAMP NULL DEFAULT NULL COMMENT \'Task start notified time\'')
    await ensureColumn(connection, 'tasks', 'end_notified_at', '`end_notified_at` TIMESTAMP NULL DEFAULT NULL COMMENT \'Task end notified time\'')
    await ensureIndex(connection, 'merchant_staffs', 'idx_merchant_id', 'INDEX `idx_merchant_id` (`merchant_id`)')
    await ensureIndex(connection, 'merchant_staffs', 'idx_role', 'INDEX `idx_role` (`role`)')
  }
}
