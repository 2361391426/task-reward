const jwt = require('jsonwebtoken')
const db = require('./db')

const DEV_JWT_SECRET = 'dev-only-secret-change-before-production'
const isProduction = ['production', 'prod'].includes((process.env.NODE_ENV || '').toLowerCase()) ||
  process.env.VERCEL_ENV === 'production'

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET
  }

  if (isProduction) {
    throw new Error('生产环境必须配置 JWT_SECRET')
  }

  if (!getJwtSecret.warned) {
    console.warn('[auth] JWT_SECRET 未配置，当前使用本地开发兜底密钥。')
    getJwtSecret.warned = true
  }

  return DEV_JWT_SECRET
}

function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, getJwtSecret(), { expiresIn })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret())
  } catch (error) {
    return null
  }
}

async function authenticateUser(req) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: { code: 1002, message: '请先登录' }, status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')
  const decoded = verifyToken(token)

  if (!decoded || decoded.type !== 'user') {
    return { error: { code: 1002, message: '登录已失效，请重新登录' }, status: 401 }
  }

  const user = await db.queryOne(
    'SELECT * FROM users WHERE id = ? AND status = 1',
    [decoded.user_id]
  )

  if (!user) {
    return { error: { code: 2001, message: '用户不存在或已停用' }, status: 401 }
  }

  return { user }
}

async function authenticateMerchant(req) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: { code: 1002, message: '请先登录' }, status: 401 }
  }

  const token = authHeader.replace('Bearer ', '')
  const decoded = verifyToken(token)

  if (!decoded || !['merchant', 'merchant_staff'].includes(decoded.type)) {
    return { error: { code: 1002, message: '登录已失效，请重新登录' }, status: 401 }
  }

  if (decoded.type === 'merchant_staff') {
    const staff = await db.queryOne(
      `SELECT s.*, m.id AS merchant_id, m.username AS merchant_username, m.company_name, m.balance, m.status AS merchant_status
       FROM merchant_staffs s
       JOIN merchants m ON m.id = s.merchant_id
       WHERE s.id = ? AND s.status = 1 AND m.status = 1`,
      [decoded.user_id]
    )

    if (!staff) {
      return { error: { code: 2001, message: '商家员工账号不存在或已停用' }, status: 401 }
    }

    return {
      merchant: {
        id: parseInt(staff.merchant_id, 10),
        merchant_id: parseInt(staff.merchant_id, 10),
        staff_id: parseInt(staff.id, 10),
        username: staff.username,
        nickname: staff.nickname || staff.username,
        company_name: staff.company_name,
        balance: staff.balance,
        role: staff.role || 'operator',
        account_type: 'merchant_staff'
      }
    }
  }

  const merchant = await db.queryOne(
    'SELECT * FROM merchants WHERE id = ? AND status = 1',
    [decoded.user_id]
  )

  if (!merchant) {
    return { error: { code: 2001, message: '商家账号不存在或已停用' }, status: 401 }
  }

  return {
    merchant: {
      merchant_id: merchant.id,
      staff_id: null,
      id: merchant.id,
      role: 'owner',
      account_type: 'merchant'
    }
  }
}

function merchantRoleAllowed(merchant, roles = []) {
  if (!merchant) return false
  if (merchant.account_type === 'merchant') return true
  if (!Array.isArray(roles) || roles.length === 0) return true
  return roles.includes(merchant.role)
}

module.exports = {
  generateToken,
  verifyToken,
  authenticateUser,
  authenticateMerchant,
  merchantRoleAllowed
}
