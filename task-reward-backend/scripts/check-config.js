const requiredProductionVars = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'WECHAT_APPID',
  'WECHAT_SECRET'
]

const mode = (process.env.CHECK_MODE || process.env.NODE_ENV || 'local').toLowerCase()
const missing = requiredProductionVars.filter((key) => !process.env[key])

if (mode === 'production') {
  if (missing.length > 0) {
    console.error('Missing required production environment variables:')
    missing.forEach((key) => console.error(`- ${key}`))
    process.exit(1)
  }

  console.log('Production config check passed.')
  process.exit(0)
}

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Local fallback secret will be used.')
}

const info = {
  mode,
  requiredProductionVars: requiredProductionVars.length,
  missingInCurrentEnv: missing
}

console.log(JSON.stringify(info, null, 2))
