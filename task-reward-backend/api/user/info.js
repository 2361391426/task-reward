const db = require('../../lib/db')
const { authenticateUser } = require('../../lib/auth')
const { success, error } = require('../../lib/response')
const { decrypt, maskPhone } = require('../../lib/crypto')

const safeDecrypt = (value) => {
  if (!value) return ''
  try {
    return decrypt(value)
  } catch (err) {
    return value
  }
}

const parseTags = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : [parsed].filter(Boolean)
    } catch {
      return [value]
    }
  }
  return [value]
}

const getRiskSnapshot = async (userId) => {
  const risk = await db.queryOne(
    `SELECT status, risk_reason, risk_tags, blocked_at, cleared_at
     FROM user_risk_flags
     WHERE user_id = ?`,
    [userId]
  )

  const cooldowns = await db.query(
    `SELECT platform, last_submission_id, last_submission_at, cooldown_until, cooldown_months, reason
     FROM user_platform_cooldowns
     WHERE user_id = ?
     ORDER BY updated_at DESC`,
    [userId]
  )

  return {
    risk_status: risk ? parseInt(risk.status, 10) || 0 : 0,
    risk_reason: risk?.risk_reason || '',
    risk_tags: parseTags(risk?.risk_tags),
    blocked_at: risk?.blocked_at || null,
    cleared_at: risk?.cleared_at || null,
    platform_cooldowns: cooldowns.map(item => ({
      platform: item.platform,
      last_submission_id: item.last_submission_id,
      last_submission_at: item.last_submission_at,
      cooldown_until: item.cooldown_until,
      cooldown_months: parseInt(item.cooldown_months, 10) || 3,
      reason: item.reason || ''
    }))
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json(error(405, 'Method not allowed'))
  }

  try {
    const auth = await authenticateUser(req, res)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    const user = auth.user
    const risk = await getRiskSnapshot(user.id)

    let phone = null
    if (user.phone) {
      const decryptedPhone = safeDecrypt(user.phone)
      phone = maskPhone(decryptedPhone)
    }

    res.json(success({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      phone,
      total_earnings: parseFloat(user.total_earnings || 0),
      available_balance: parseFloat(user.available_balance || 0),
      frozen_balance: parseFloat(user.frozen_balance || 0),
      ...risk
    }))
  } catch (err) {
    console.error('Get user info error:', err)
    res.status(500).json(error(500, '服务器错误'))
  }
}
