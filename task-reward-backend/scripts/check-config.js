require('dotenv').config({ path: '.env.scf' })
require('dotenv').config({ path: '.env' })

const mode = (process.env.CHECK_MODE || process.env.NODE_ENV || 'local').toLowerCase()
const isProduction = mode === 'production'

const requiredVars = [
  'JWT_SECRET',
  'WECHAT_APPID',
  'CRYPTO_KEY',
  'CRYPTO_IV',
  'R2_ENDPOINT',
  'R2_BUCKET',
  'R2_PUBLIC_URL',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY'
]

const requiredDbVars = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME']
const missing = requiredVars.filter((key) => !process.env[key])
const dbMode = process.env.DATABASE_URL ? 'neon' : 'mysql'

if (dbMode === 'mysql') {
  missing.push(...requiredDbVars.filter((key) => !process.env[key]))
} else if (!process.env.DATABASE_URL) {
  missing.push('DATABASE_URL')
}

const invalid = []

if (!process.env.WECHAT_SECRET && !process.env.WECHAT_APPSECRET) {
  missing.push('WECHAT_SECRET / WECHAT_APPSECRET')
}

if (isProduction && !process.env.TASK_LIFECYCLE_SWEEP_SECRET) {
  console.warn('未配置 TASK_LIFECYCLE_SWEEP_SECRET，部署流程会使用 JWT_SECRET 派生调度密钥。')
}

if (process.env.WECHAT_APPID === 'touristappid' || process.env.WECHAT_APPID === 'your_wechat_appid') {
  invalid.push({ key: 'WECHAT_APPID', reason: '不能使用占位值' })
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  invalid.push({ key: 'JWT_SECRET', reason: '长度至少 32 个字符' })
}

if (process.env.CRYPTO_KEY && Buffer.byteLength(process.env.CRYPTO_KEY, 'utf8') !== 32) {
  invalid.push({ key: 'CRYPTO_KEY', reason: '必须正好 32 字节' })
}

if (process.env.CRYPTO_IV && Buffer.byteLength(process.env.CRYPTO_IV, 'utf8') !== 16) {
  invalid.push({ key: 'CRYPTO_IV', reason: '必须正好 16 字节' })
}

if (process.env.R2_PUBLIC_URL && !/^https:\/\//i.test(process.env.R2_PUBLIC_URL)) {
  invalid.push({ key: 'R2_PUBLIC_URL', reason: '必须是 https 地址' })
}

if (process.env.R2_ENDPOINT && !/^https:\/\//i.test(process.env.R2_ENDPOINT)) {
  invalid.push({ key: 'R2_ENDPOINT', reason: '必须是 https 地址' })
}

if (isProduction) {
  if (missing.length > 0 || invalid.length > 0) {
    console.error('生产环境配置不完整：')
    missing.forEach((key) => console.error(`- 缺少 ${key}`))
    invalid.forEach((item) => console.error(`- ${item.key}: ${item.reason}`))
    process.exit(1)
  }

  console.log('生产环境配置检查通过。')
  process.exit(0)
}

if (!process.env.JWT_SECRET) {
  console.warn('未配置 JWT_SECRET，开发环境会使用兜底密钥。')
}

console.log(JSON.stringify({
  mode,
  dbMode,
  missingInCurrentEnv: missing,
  invalidInCurrentEnv: invalid
}, null, 2))
