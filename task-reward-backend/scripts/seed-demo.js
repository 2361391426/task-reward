const bcrypt = require('bcryptjs')
const db = require('../lib/db')

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seed is disabled in production. Set ALLOW_DEMO_SEED=true to override.')
  }

  if (!process.env.DATABASE_URL && (!process.env.DB_HOST || !process.env.DB_USERNAME || !process.env.DB_NAME)) {
    throw new Error('Missing DB_HOST, DB_USERNAME, or DB_NAME')
  }

  const existing = await db.queryOne(
    'SELECT id FROM merchants WHERE username = ? LIMIT 1',
    ['admin']
  )

  if (existing) {
    console.log('Demo merchant already exists.')
    return
  }

  const passwordHash = await bcrypt.hash('admin123', 10)
  await db.execute(
    `INSERT INTO merchants
     (username, password, company_name, contact_phone, balance, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    ['admin', passwordHash, 'Demo merchant', '13800138000', 10000.0]
  )

  console.log('Demo merchant seed completed.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
