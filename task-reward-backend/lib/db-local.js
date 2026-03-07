const Database = require('better-sqlite3')
const path = require('path')

let db = null

// 初始化数据库
const initDB = () => {
  if (db) return db

  const dbPath = process.env.DB_PATH || path.join(__dirname, '../test.db')
  db = new Database(dbPath)

  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT UNIQUE NOT NULL,
      nickname TEXT,
      avatar TEXT,
      phone TEXT,
      balance DECIMAL(10,2) DEFAULT 0,
      total_earnings DECIMAL(10,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      balance DECIMAL(10,2) DEFAULT 0,
      status INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      search_keyword TEXT NOT NULL,
      shop_name TEXT NOT NULL,
      product_name TEXT NOT NULL,
      reward_amount DECIMAL(10,2) NOT NULL,
      total_quota INTEGER NOT NULL,
      used_quota INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,
      end_time DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      screenshot_search TEXT NOT NULL,
      screenshot_shop_1 TEXT NOT NULL,
      screenshot_shop_2 TEXT NOT NULL,
      screenshot_shop_3 TEXT NOT NULL,
      screenshot_follow TEXT NOT NULL,
      screenshot_share TEXT NOT NULL,
      screenshot_detail TEXT NOT NULL,
      screenshot_cart TEXT NOT NULL,
      review_status INTEGER DEFAULT 0,
      review_note TEXT,
      review_time DATETIME,
      submit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS earnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      balance DECIMAL(10,2) NOT NULL,
      related_id INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  console.log('✅ SQLite 数据库初始化完成')
  return db
}

// 查询封装
const query = (sql, params = []) => {
  const database = initDB()
  try {
    const stmt = database.prepare(sql)
    return stmt.all(...params)
  } catch (err) {
    console.error('Query error:', err)
    throw err
  }
}

// 执行封装
const execute = (sql, params = []) => {
  const database = initDB()
  try {
    const stmt = database.prepare(sql)
    const result = stmt.run(...params)
    return { insertId: result.lastInsertRowid, changes: result.changes }
  } catch (err) {
    console.error('Execute error:', err)
    throw err
  }
}

module.exports = {
  initDB,
  query,
  execute
}
