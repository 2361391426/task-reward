const path = require('path')
const bcrypt = require('bcryptjs')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env.scf') })

const neon = require('@neondatabase/serverless')

try {
  neon.neonConfig.webSocketConstructor = require('ws')
} catch (error) {
  // Node 18+ has a built-in WebSocket in many runtimes; ws is only needed locally.
}

const required = ['DATABASE_URL', 'ADMIN_USERNAME', 'ADMIN_PASSWORD']
const missing = required.filter((key) => !process.env[key])

if (missing.length > 0) {
  console.error(`缺少环境变量: ${missing.join(', ')}`)
  process.exit(1)
}

const username = process.env.ADMIN_USERNAME
const password = process.env.ADMIN_PASSWORD
const companyName = process.env.ADMIN_COMPANY_NAME || '商家'
const contactPhone = process.env.ADMIN_CONTACT_PHONE || ''
const initialBalance = Number(process.env.ADMIN_INITIAL_BALANCE || 10000)

async function main() {
  const pool = new neon.Pool({
    connectionString: process.env.DATABASE_URL
  })

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      `INSERT INTO merchants
       (username, password, company_name, contact_phone, balance, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
       ON CONFLICT (username) DO UPDATE SET
         password = EXCLUDED.password,
         company_name = EXCLUDED.company_name,
         contact_phone = EXCLUDED.contact_phone,
         status = 1,
         updated_at = NOW()
       RETURNING id, username, company_name, contact_phone, balance, status`,
      [username, passwordHash, companyName, contactPhone, initialBalance]
    )

    const merchant = result.rows[0]
    console.log(`管理员已生效: ${merchant.username}`)
    console.log(`商家名称: ${merchant.company_name}`)
    console.log(`手机号: ${merchant.contact_phone}`)
    console.log(`状态: ${merchant.status === 1 ? '启用' : merchant.status}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(`创建管理员失败: ${error.message}`)
  process.exit(1)
})
