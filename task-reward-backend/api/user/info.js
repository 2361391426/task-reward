const db = require('../../lib/db')
const { authenticateUser } = require('../../lib/auth')
const { success, error } = require('../../lib/response')
const { encrypt, decrypt, maskPhone } = require('../../lib/crypto')

const safeDecrypt = (value) => {
  if (!value) return ''
  try {
    return decrypt(value)
  } catch (err) {
    return value
  }
}

const normalizePhone = (value) => String(value || '').replace(/\D/g, '').trim()
const isValidPhone = (value) => /^1\d{10}$/.test(value)

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

const getEmptyRiskSnapshot = () => ({
  risk_status: 0,
  risk_reason: '',
  risk_tags: [],
  blocked_at: null,
  cleared_at: null,
  platform_cooldowns: []
})

const getRiskSnapshot = async (userId) => {
  try {
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
  } catch (err) {
    console.warn('读取用户风控信息失败，已跳过:', err.message)
    return getEmptyRiskSnapshot()
  }
}

const formatUser = async (user) => {
  const decryptedPhone = user?.phone ? safeDecrypt(user.phone) : ''
  const risk = await getRiskSnapshot(user.id)

  return {
    id: user.id,
    nickname: user.nickname,
    avatar: user.avatar,
    phone: decryptedPhone ? maskPhone(decryptedPhone) : null,
    phone_raw: decryptedPhone,
    total_earnings: parseFloat(user.total_earnings || 0),
    available_balance: parseFloat(user.available_balance || 0),
    frozen_balance: parseFloat(user.frozen_balance || 0),
    publish_permission: parseInt(user.publish_permission || 0, 10) || 0,
    ...risk
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json(error(405, '请求方法不支持'))
  }

  try {
    const auth = await authenticateUser(req, res)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    if (req.method === 'PUT') {
      const nickname = String(req.body?.nickname || '').trim()
      const avatar = String(req.body?.avatar || '').trim()
      const phoneInput = normalizePhone(req.body?.phone)
      const updates = []
      const params = []

      if (nickname) {
        updates.push('nickname = ?')
        params.push(nickname)
      }

      if (avatar) {
        updates.push('avatar = ?')
        params.push(avatar)
      }

      if (phoneInput) {
        if (!isValidPhone(phoneInput)) {
          return res.status(400).json(error(1001, '请输入正确的 11 位手机号'))
        }
        updates.push('phone = ?')
        params.push(encrypt(phoneInput))
      }

      if (!updates.length) {
        return res.json(success(await formatUser(auth.user)))
      }

      updates.push('updated_at = NOW()')
      params.push(auth.user.id)

      await db.execute(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        params
      )

      const freshUser = await db.queryOne('SELECT * FROM users WHERE id = ?', [auth.user.id])
      return res.json(success(await formatUser(freshUser || auth.user)))
    }

    return res.json(success(await formatUser(auth.user)))
  } catch (err) {
    console.error('保存或读取用户资料失败:', err)
    return res.status(500).json(error(500, '服务器错误，请稍后重试'))
  }
}
