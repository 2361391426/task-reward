const db = require('../../../lib/db')
const { authenticateMerchant } = require('../../../lib/auth')
const { success, error, ErrorCodes } = require('../../../lib/response')
const { parsePositiveInt } = require('../../../lib/pagination')

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

const normalizePagination = (page, pageSize) => {
  const currentPage = Math.max(parseInt(page, 10) || 1, 1)
  const currentPageSize = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 50)
  return {
    page: currentPage,
    page_size: currentPageSize,
    offset: (currentPage - 1) * currentPageSize
  }
}

const getUserRiskSnapshot = async (userId) => {
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

  const identityLinks = await db.query(
    `SELECT identity_type, COUNT(*) AS link_count
     FROM user_identity_links
     WHERE user_id = ?
     GROUP BY identity_type`,
    [userId]
  )

  return {
    risk_status: risk ? parsePositiveInt(risk.status, 0) : 0,
    risk_reason: risk?.risk_reason || '',
    risk_tags: parseTags(risk?.risk_tags),
    blocked_at: risk?.blocked_at || null,
    cleared_at: risk?.cleared_at || null,
    platform_cooldowns: cooldowns.map(item => ({
      platform: item.platform,
      last_submission_id: item.last_submission_id,
      last_submission_at: item.last_submission_at,
      cooldown_until: item.cooldown_until,
      cooldown_months: parsePositiveInt(item.cooldown_months, 3) || 3,
      reason: item.reason || ''
    })),
    identity_types: identityLinks.map(item => item.identity_type),
    identity_count: identityLinks.reduce((sum, item) => sum + parsePositiveInt(item.link_count, 0), 0)
  }
}

const setRiskFlag = async (userId, status, reason, tags = [], source = 'merchant') => {
  const existing = await db.queryOne(
    'SELECT id FROM user_risk_flags WHERE user_id = ?',
    [userId]
  )

  const payload = {
    status: status ? 1 : 0,
    risk_reason: reason || '',
    risk_tags: JSON.stringify(tags || []),
    source,
    blocked_at: status ? new Date().toISOString() : null,
    cleared_at: status ? null : new Date().toISOString()
  }

  if (existing) {
    await db.execute(
      `UPDATE user_risk_flags
       SET status = ?,
           risk_reason = ?,
           risk_tags = ?,
           source = ?,
           blocked_at = ?,
           cleared_at = ?,
           updated_at = NOW()
       WHERE user_id = ?`,
      [
        payload.status,
        payload.risk_reason,
        payload.risk_tags,
        payload.source,
        payload.blocked_at,
        payload.cleared_at,
        userId
      ]
    )
    return existing.id
  }

  const result = await db.execute(
    `INSERT INTO user_risk_flags
     (user_id, status, risk_reason, risk_tags, source, blocked_at, cleared_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      userId,
      payload.status,
      payload.risk_reason,
      payload.risk_tags,
      payload.source,
      payload.blocked_at,
      payload.cleared_at
    ]
  )
  return result.insertId
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json(error(405, 'Method not allowed'))
  }

  try {
    const auth = await authenticateMerchant(req, res)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    if (req.method === 'GET') {
      const { page = 1, page_size = 20, keyword = '', status = '' } = req.query
      const pagination = normalizePagination(page, page_size)

      const where = []
      const params = []
      if (keyword) {
        where.push('(u.nickname LIKE ? OR u.openid LIKE ? OR u.phone LIKE ?)')
        const like = `%${keyword}%`
        params.push(like, like, like)
      }
      if (status !== '') {
        where.push('IFNULL(r.status, 0) = ?')
        params.push(parsePositiveInt(status, 0))
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
      const countRows = await db.queryOne(
        `SELECT COUNT(*) AS total
         FROM users u
         LEFT JOIN user_risk_flags r ON r.user_id = u.id
         ${whereClause}`,
        params
      )

      const users = await db.query(
        `SELECT u.id, u.openid, u.unionid, u.nickname, u.avatar, u.phone, u.total_earnings,
                u.available_balance, u.frozen_balance, u.status AS user_status, u.created_at,
                r.status AS risk_status, r.risk_reason, r.risk_tags, r.blocked_at, r.cleared_at
         FROM users u
         LEFT JOIN user_risk_flags r ON r.user_id = u.id
         ${whereClause}
         ORDER BY COALESCE(r.blocked_at, u.created_at) DESC
         LIMIT ? OFFSET ?`,
        [...params, pagination.page_size, pagination.offset]
      )

      const list = await Promise.all(users.map(async (user) => ({
        id: user.id,
        openid: user.openid,
        unionid: user.unionid,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        total_earnings: parseFloat(user.total_earnings || 0),
        available_balance: parseFloat(user.available_balance || 0),
        frozen_balance: parseFloat(user.frozen_balance || 0),
        user_status: parsePositiveInt(user.user_status, 1),
        created_at: user.created_at,
        risk_status: user.risk_status !== null && user.risk_status !== undefined ? parsePositiveInt(user.risk_status, 0) : 0,
        risk_reason: user.risk_reason || '',
        risk_tags: parseTags(user.risk_tags),
        blocked_at: user.blocked_at || null,
        cleared_at: user.cleared_at || null,
        ...(await getUserRiskSnapshot(user.id))
      })))

      return res.json(success({
        total: countRows?.total || 0,
        page: pagination.page,
        page_size: pagination.page_size,
        list
      }))
    }

    const userId = parseInt(req.body.user_id ?? req.body.id, 10)
    if (!userId) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少用户ID'))
    }

    const status = req.body.status
    const nextStatus = typeof status === 'boolean'
      ? (status ? 1 : 0)
      : parsePositiveInt(status, 1)
    const riskReason = (req.body.risk_reason || req.body.reason || '').trim()
    const riskTags = Array.isArray(req.body.risk_tags)
      ? req.body.risk_tags
      : parseTags(req.body.risk_tags)

    await setRiskFlag(userId, nextStatus === 1, riskReason || '后台手动标记', riskTags, 'merchant')

    return res.json(success({
      user_id: userId,
      risk_status: nextStatus,
      risk_reason: riskReason || '后台手动标记',
      risk_tags: riskTags
    }))
  } catch (err) {
    console.error('Risk users error:', err)
    return res.status(500).json(error(500, 'Server error'))
  }
}
