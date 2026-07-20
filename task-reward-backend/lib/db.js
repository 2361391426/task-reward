const {
  ensureReturningId,
  isInsertSql,
  isSelectSql,
  translateMysqlToPostgres
} = require('./sql-compat')

let mysqlPool = null
let neonPool = null
let neonRuntime = null

const isNeonMode = Boolean(process.env.DATABASE_URL)
const QUERY_TIMEOUT_MS = Number(process.env.DB_QUERY_TIMEOUT_MS || 8000)

const getWebSocketConstructor = () => {
  if (typeof WebSocket !== 'undefined') {
    return WebSocket
  }

  try {
    return require('ws')
  } catch (error) {
    return null
  }
}

const getNeonRuntime = () => {
  if (!neonRuntime) {
    neonRuntime = require('@neondatabase/serverless')
    const webSocketConstructor = getWebSocketConstructor()
    if (webSocketConstructor) {
      neonRuntime.neonConfig.webSocketConstructor = webSocketConstructor
    }
  }
  return neonRuntime
}

const withTimeout = (promise, timeoutMs, label = '数据库查询超时') => {
  let timer = null
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

const getMysqlPool = () => {
  if (!mysqlPool) {
    const mysql = require('mysql2/promise')
    mysqlPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: {
        rejectUnauthorized: true
      }
    })
  }
  return mysqlPool
}

const getNeonPool = () => {
  if (!neonPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required for Neon mode')
    }

    const { Pool } = getNeonRuntime()
    neonPool = new Pool({
      connectionString: process.env.DATABASE_URL
    })

    if (typeof neonPool.on === 'function') {
      neonPool.on('error', (err) => {
        console.warn('[db] Neon pool error:', err && err.message ? err.message : err)
      })
    }
  }
  return neonPool
}

const normalizeMysqlRows = (result) => {
  if (Array.isArray(result)) {
    return result
  }
  return []
}

const makeMysqlLikeResult = ({ rows, rowCount, insertId = null }) => ({
  affectedRows: rowCount || 0,
  changedRows: rowCount || 0,
  insertId,
  rows
})

const runMysqlQuery = async (sql, params = []) => {
  const pool = getMysqlPool()
  return pool.query(sql, params)
}

const runNeonQuery = async (sql, params = [], client = null) => {
  const translatedSql = translateMysqlToPostgres(sql)
  const connection = client || getNeonPool()
  const executableSql = isInsertSql(translatedSql) ? ensureReturningId(translatedSql) : translatedSql
  const result = await withTimeout(
    connection.query(executableSql, params),
    QUERY_TIMEOUT_MS,
    `数据库查询超时：${QUERY_TIMEOUT_MS}ms`
  )
  return {
    sql: executableSql,
    rows: result.rows || [],
    rowCount: result.rowCount || 0
  }
}

async function query(sql, params = []) {
  if (!isNeonMode) {
    const [rows] = await runMysqlQuery(sql, params)
    return normalizeMysqlRows(rows)
  }

  const result = await runNeonQuery(sql, params)
  return result.rows
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params)
  return rows[0] || null
}

async function execute(sql, params = []) {
  if (!isNeonMode) {
    const pool = getMysqlPool()
    const [result] = await pool.execute(sql, params)
    return result
  }

  const result = await runNeonQuery(sql, params)
  const firstRow = result.rows[0] || null
  const insertId = firstRow && Object.prototype.hasOwnProperty.call(firstRow, 'id')
    ? firstRow.id
    : null

  return makeMysqlLikeResult({
    rows: result.rows,
    rowCount: result.rowCount,
    insertId
  })
}

const createMysqlLikeConnection = (client) => {
  return {
    query: async (sql, params = []) => {
      const result = await runNeonQuery(sql, params, client)
      if (isSelectSql(sql) || /^WITH\b/i.test(sql)) {
        return [result.rows, { rowCount: result.rowCount }]
      }

      if (isInsertSql(sql)) {
        const firstRow = result.rows[0] || null
        const insertId = firstRow && Object.prototype.hasOwnProperty.call(firstRow, 'id')
          ? firstRow.id
          : null
        return [makeMysqlLikeResult({
          rows: result.rows,
          rowCount: result.rowCount,
          insertId
        }), { rowCount: result.rowCount }]
      }

      return [makeMysqlLikeResult({
        rows: result.rows,
        rowCount: result.rowCount
      }), { rowCount: result.rowCount }]
    },
    execute: async (sql, params = []) => {
      const result = await runNeonQuery(sql, params, client)
      const firstRow = result.rows[0] || null
      const insertId = firstRow && Object.prototype.hasOwnProperty.call(firstRow, 'id')
        ? firstRow.id
        : null
      return [makeMysqlLikeResult({
        rows: result.rows,
        rowCount: result.rowCount,
        insertId
      }), { rowCount: result.rowCount }]
    }
  }
}

async function transaction(callback) {
  if (!isNeonMode) {
    const pool = getMysqlPool()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()
      const result = await callback(connection)
      await connection.commit()
      return result
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  const pool = getNeonPool()
  const client = await pool.connect()
  const txClient = createMysqlLikeConnection(client)

  try {
    await client.query('BEGIN')
    const result = await callback(txClient)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  query,
  queryOne,
  execute,
  transaction,
  getPool: () => (isNeonMode ? getNeonPool() : getMysqlPool())
}
