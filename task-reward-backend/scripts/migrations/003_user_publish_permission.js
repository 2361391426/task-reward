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

module.exports = {
  name: '003_user_publish_permission',
  mysqlOnly: true,
  up: async (connection) => {
    await ensureColumn(
      connection,
      'users',
      'publish_permission',
      '`publish_permission` TINYINT NOT NULL DEFAULT 0 COMMENT \'1 can view publish tasks\''
    )
    await ensureColumn(
      connection,
      'users',
      'status',
      '`status` TINYINT NOT NULL DEFAULT 1 COMMENT \'1 active, 2 disabled\''
    )
  }
}
