const fs = require('fs')
const path = require('path')

const DB_FILE = path.join(__dirname, '../data.json')
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'

let db = {
  users: [],
  merchants: [],
  merchant_staffs: [],
  tasks: [],
  submissions: [],
  earnings: [],
  withdrawals: [],
  merchant_recharges: [],
  audit_logs: [],
  feedbacks: [],
  user_identity_links: [],
  user_risk_flags: [],
  user_platform_cooldowns: [],
  login_attempts: []
}

const ensureTables = (source) => ({
  users: [],
  merchants: [],
  merchant_staffs: [],
  tasks: [],
  submissions: [],
  earnings: [],
  withdrawals: [],
  merchant_recharges: [],
  audit_logs: [],
  feedbacks: [],
  user_identity_links: [],
  user_risk_flags: [],
  user_platform_cooldowns: [],
  login_attempts: [],
  ...source
})

const clone = (value) => JSON.parse(JSON.stringify(value))

const loadDB = () => {
  if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE, 'utf8')
    db = ensureTables(JSON.parse(data))
  }
}

const saveDB = () => {
  const tempFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2))
  fs.renameSync(tempFile, DB_FILE)
}

const initDB = () => {
  loadDB()

  if (db.merchants.length === 0 && !isProduction) {
    const bcrypt = require('bcryptjs')
    db.merchants.push({
      id: 1,
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      company_name: '测试商家',
      contact_phone: '13800138000',
      balance: 10000.0,
      created_at: new Date().toISOString()
    })
    saveDB()
  }

  console.log('JSON 数据库初始化完成')
}

const query = (table, filter = {}) => {
  loadDB()
  let results = db[table] || []

  if (Object.keys(filter).length > 0) {
    results = results.filter(item => {
      return Object.keys(filter).every(key => item[key] === filter[key])
    })
  }

  return results
}

const queryOne = (table, filter = {}) => {
  const results = query(table, filter)
  return results.length > 0 ? results[0] : null
}

const insert = (table, data) => {
  loadDB()

  if (!db[table]) {
    db[table] = []
  }

  const maxId = db[table].length > 0
    ? Math.max(...db[table].map(item => item.id || 0))
    : 0

  const newItem = {
    id: maxId + 1,
    ...data,
    created_at: data.created_at || new Date().toISOString()
  }

  db[table].push(newItem)
  saveDB()

  return newItem
}

const update = (table, filter, data) => {
  loadDB()

  let updated = 0
  db[table] = (db[table] || []).map(item => {
    const match = Object.keys(filter).every(key => item[key] === filter[key])
    if (match) {
      updated++
      return { ...item, ...data, updated_at: new Date().toISOString() }
    }
    return item
  })

  saveDB()
  return updated
}

const remove = (table, filter) => {
  loadDB()

  const current = db[table] || []
  const before = current.length
  db[table] = current.filter(item => {
    return !Object.keys(filter).every(key => item[key] === filter[key])
  })

  const deleted = before - db[table].length
  if (deleted > 0) {
    saveDB()
  }

  return deleted
}

const withTransaction = (handler) => {
  loadDB()
  const snapshot = ensureTables(clone(db))

  const tx = {
    query: (table, filter = {}) => {
      let results = snapshot[table] || []
      if (Object.keys(filter).length > 0) {
        results = results.filter(item => {
          return Object.keys(filter).every(key => item[key] === filter[key])
        })
      }
      return clone(results)
    },
    queryOne: (table, filter = {}) => {
      const results = tx.query(table, filter)
      return results.length > 0 ? results[0] : null
    },
    insert: (table, data) => {
      if (!snapshot[table]) {
        snapshot[table] = []
      }

      const maxId = snapshot[table].length > 0
        ? Math.max(...snapshot[table].map(item => item.id || 0))
        : 0

      const newItem = {
        id: maxId + 1,
        ...data,
        created_at: data.created_at || new Date().toISOString()
      }

      snapshot[table].push(newItem)
      return clone(newItem)
    },
    update: (table, filter, data) => {
      let updated = 0
      snapshot[table] = (snapshot[table] || []).map(item => {
        const match = Object.keys(filter).every(key => item[key] === filter[key])
        if (match) {
          updated++
          return { ...item, ...data, updated_at: new Date().toISOString() }
        }
        return item
      })
      return updated
    },
    remove: (table, filter) => {
      const current = snapshot[table] || []
      const before = current.length
      snapshot[table] = current.filter(item => {
        return !Object.keys(filter).every(key => item[key] === filter[key])
      })
      return before - snapshot[table].length
    }
  }

  const result = handler(tx)
  db = snapshot
  saveDB()
  return result
}

module.exports = {
  initDB,
  query,
  queryOne,
  insert,
  update,
  remove,
  withTransaction
}
