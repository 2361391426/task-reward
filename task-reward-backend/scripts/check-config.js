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

if (process.env.WECHAT_APPID === 'touristappid' || process.env.WECHAT_APPID === 'your_wechat_appid') {
  invalid.push({ key: 'WECHAT_APPID', reason: 'placeholder values cannot be used in production' })
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  invalid.push({ key: 'JWT_SECRET', reason: 'must be at least 32 characters' })
}

if (process.env.CRYPTO_KEY && Buffer.byteLength(process.env.CRYPTO_KEY, 'utf8') !== 32) {
  invalid.push({ key: 'CRYPTO_KEY', reason: 'must be exactly 32 bytes' })
}

if (process.env.CRYPTO_IV && Buffer.byteLength(process.env.CRYPTO_IV, 'utf8') !== 16) {
  invalid.push({ key: 'CRYPTO_IV', reason: 'must be exactly 16 bytes' })
}

if (process.env.R2_PUBLIC_URL && !/^https:\/\//i.test(process.env.R2_PUBLIC_URL)) {
  invalid.push({ key: 'R2_PUBLIC_URL', reason: 'must be an https URL' })
}

if (isProduction) {
  if (missing.length > 0 || invalid.length > 0) {
    console.error('Production environment configuration is incomplete:')
    missing.forEach((key) => console.error(`- ${key}`))
    invalid.forEach((item) => console.error(`- ${item.key}: ${item.reason}`))
    process.exit(1)
  }

  console.log('Production environment configuration check passed.')
  process.exit(0)
}

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not configured. Development mode will use the fallback secret.')
}

console.log(JSON.stringify({
  mode,
  dbMode,
  missingInCurrentEnv: missing,
  invalidInCurrentEnv: invalid
}, null, 2))
