const axios = require('axios')
const db = require('../../lib/db')
const { generateToken } = require('../../lib/auth')
const { success, error, ErrorCodes } = require('../../lib/response')
const { decrypt, maskPhone } = require('../../lib/crypto')

const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_LOCK_MS = 15 * 60 * 1000

const getLoginKey = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

const getLoginState = async (key) => {
  return db.queryOne(
    'SELECT login_key, count, locked_until FROM login_attempts WHERE login_key = ?',
    [key]
  ).then((entry) => {
    if (!entry) return { count: 0, lockedUntil: 0 }
    if (entry.locked_until && new Date(entry.locked_until).getTime() <= Date.now()) {
      return db.execute(
        'UPDATE login_attempts SET count = 0, locked_until = NULL WHERE login_key = ?',
        [key]
      ).then(() => ({ count: 0, lockedUntil: 0 }))
    }
    return {
      count: Number(entry.count) || 0,
      lockedUntil: entry.locked_until ? new Date(entry.locked_until).getTime() : 0
    }
  })
}

const recordLoginFailure = async (key) => {
  const current = await getLoginState(key)
  const count = current.count + 1
  const lockedUntil = count >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOGIN_LOCK_MS).toISOString() : null
  await db.execute(
    `INSERT INTO login_attempts (login_key, count, locked_until, created_at, updated_at)
     VALUES (?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       count = VALUES(count),
       locked_until = VALUES(locked_until),
       updated_at = NOW()`,
    [key, count, lockedUntil]
  )
  return { count, lockedUntil: lockedUntil ? new Date(lockedUntil).getTime() : 0 }
}

const clearLoginAttempts = (key) => {
  return db.execute(
    'UPDATE login_attempts SET count = 0, locked_until = NULL WHERE login_key = ?',
    [key]
  )
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

const safeDecrypt = (value) => {
  if (!value) return ''
  try {
    return decrypt(value)
  } catch (err) {
    return value
  }
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json(error(405, 'Method not allowed'))
  }

  try {
    const { code, nickname, avatar } = req.body
    const loginKey = getLoginKey(req)
    const loginState = await getLoginState(loginKey)
    if (loginState.lockedUntil && loginState.lockedUntil > Date.now()) {
      return res.status(429).json(error(ErrorCodes.NO_PERMISSION, 'Too many login attempts, please try again later'))
    }

    if (!code) {
      await recordLoginFailure(loginKey)
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少code参数'))
    }

    const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      proxy: false,
      timeout: 10000,
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    })

    if (data.errcode) {
      await recordLoginFailure(loginKey)
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, data.errmsg))
    }

    const { openid, unionid } = data

    let user = await db.queryOne(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    )

    if (!user) {
      const result = await db.execute(
        'INSERT INTO users (openid, unionid, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        [openid, unionid || null]
      )
      user = {
        id: result.insertId,
        openid,
        unionid,
        nickname: null,
        avatar: null,
        phone: null,
        total_earnings: 0,
        available_balance: 0,
        frozen_balance: 0
      }
    }

    const nextNickname = String(nickname || '').trim()
    const nextAvatar = String(avatar || '').trim()
    if (nextNickname || nextAvatar) {
      const updates = []
      const params = []
      if (nextNickname) {
        updates.push('nickname = ?')
        params.push(nextNickname)
        user.nickname = nextNickname
      }
      if (nextAvatar) {
        updates.push('avatar = ?')
        params.push(nextAvatar)
        user.avatar = nextAvatar
      }
      if (updates.length > 0) {
        updates.push('updated_at = NOW()')
        params.push(user.id)
        await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)
      }
    }

    let phone = null
    if (user.phone) {
      const decryptedPhone = safeDecrypt(user.phone)
      phone = maskPhone(decryptedPhone)
    }

    const risk = await getRiskSnapshot(user.id)
    await clearLoginAttempts(loginKey)

    const token = generateToken({
      user_id: user.id,
      type: 'user'
    }, '7d')

    res.json(success({
      token,
        user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        phone,
        total_earnings: parseFloat(user.total_earnings || 0),
        available_balance: parseFloat(user.available_balance || 0),
        frozen_balance: parseFloat(user.frozen_balance || 0),
        publish_permission: parseInt(user.publish_permission || 0, 10) || 0,
        ...risk
      }
    }))
  } catch (err) {
    console.error('Login error:', err)
    await recordLoginFailure(getLoginKey(req))
    res.status(500).json(error(500, '服务器错误'))
  }
}
