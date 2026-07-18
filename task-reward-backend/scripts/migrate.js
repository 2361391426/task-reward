const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const db = require('../lib/db')

const rootDir = path.join(__dirname, '..')
const mysqlInitSqlPath = path.join(rootDir, 'database', 'init.sql')
const postgresInitSqlPath = path.join(rootDir, 'database', 'init-postgres.sql')
const migrationsDir = path.join(__dirname, 'migrations')

const readMigrationFiles = () => {
  if (!fs.existsSync(migrationsDir)) {
    return []
  }

  return fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.js'))
    .sort()
    .map((file) => require(path.join(migrationsDir, file)))
}

async function main() {
  const isNeonMode = Boolean(process.env.DATABASE_URL)

  if (!isNeonMode && (!process.env.DB_HOST || !process.env.DB_USERNAME || !process.env.DB_NAME)) {
    throw new Error('Missing DB_HOST, DB_USERNAME, or DB_NAME')
  }

  const initSqlPath = isNeonMode ? postgresInitSqlPath : mysqlInitSqlPath
  const initSql = fs.readFileSync(initSqlPath, 'utf8')
  const migrations = readMigrationFiles()

  if (isNeonMode) {
    const pool = db.getPool()

    await pool.query(initSql)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    const appliedRows = await db.query('SELECT name FROM schema_migrations ORDER BY name')
    const applied = new Set(appliedRows.map((row) => row.name))

    for (const migration of migrations) {
      if (!migration || !migration.name || typeof migration.up !== 'function') {
        continue
      }

      if (applied.has(migration.name)) {
        continue
      }

      await db.transaction(async (connection) => {
        await migration.up(connection)
        await connection.query(
          'INSERT INTO schema_migrations (name, applied_at) VALUES (?, NOW())',
          [migration.name]
        )
      })

      console.log(`Applied migration: ${migration.name}`)
    }

    console.log('Database migration completed.')
    return
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  })

  try {
    await connection.query(initSql)

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    const [appliedRows] = await connection.query('SELECT name FROM schema_migrations ORDER BY name')
    const applied = new Set(appliedRows.map((row) => row.name))

    for (const migration of migrations) {
      if (!migration || !migration.name || typeof migration.up !== 'function') {
        continue
      }

      if (applied.has(migration.name)) {
        continue
      }

      await migration.up(connection)
      await connection.query(
        'INSERT INTO schema_migrations (name, applied_at) VALUES (?, NOW())',
        [migration.name]
      )
      console.log(`Applied migration: ${migration.name}`)
    }

    console.log('Database migration completed.')
  } finally {
    await connection.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
