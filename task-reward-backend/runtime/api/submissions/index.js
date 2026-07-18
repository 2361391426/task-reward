const db = require('../../lib/db')
const { authenticateUser } = require('../../lib/auth')
const { success, error, ErrorCodes } = require('../../lib/response')
const { encrypt } = require('../../lib/crypto')
const { parsePositiveInt } = require('../../lib/pagination')
const { syncExpiredTasks } = require('../../lib/task-lifecycle')
const {
  buildIdentityCandidates,
  buildIdentityConflictReason,
  buildCooldownReason,
  buildBlockedReason,
  maskValue
} = require('../../lib/fraud')

const addMonths = (value, months) => {
  const date = new Date(value)
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

const isSocialPlatform = (platform) => ['douyin', 'xiaohongshu'].includes(platform)

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

const getRiskSnapshot = async (connection, userId) => {
  const [riskRows] = await connection.query(
    `SELECT status, risk_reason, risk_tags, blocked_at, cleared_at
     FROM user_risk_flags
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  )

  const [cooldownRows] = await connection.query(
    `SELECT platform, last_submission_id, last_submission_at, cooldown_until, cooldown_months, reason
     FROM user_platform_cooldowns
     WHERE user_id = ?
     ORDER BY updated_at DESC`,
    [userId]
  )

  const risk = riskRows[0] || null
  return {
    status: risk ? parsePositiveInt(risk.status, 0) : 0,
    reason: risk?.risk_reason || '',
    tags: parseTags(risk?.risk_tags),
    blocked_at: risk?.blocked_at || null,
    cleared_at: risk?.cleared_at || null,
    cooldowns: cooldownRows.map(item => ({
      platform: item.platform,
      last_submission_id: item.last_submission_id,
      last_submission_at: item.last_submission_at,
      cooldown_until: item.cooldown_until,
      cooldown_months: parsePositiveInt(item.cooldown_months, 3) || 3,
      reason: item.reason || ''
    }))
  }
}

const upsertRiskFlag = async (connection, userId, reason, tags = [], source = 'submission') => {
  await connection.query(
    `INSERT INTO user_risk_flags
     (user_id, status, risk_reason, risk_tags, source, blocked_at, cleared_at, created_at, updated_at)
     VALUES (?, 1, ?, ?, ?, NOW(), NULL, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       status = 1,
       risk_reason = VALUES(risk_reason),
       risk_tags = VALUES(risk_tags),
       source = VALUES(source),
       blocked_at = NOW(),
       cleared_at = NULL,
       updated_at = NOW()`,
    [userId, reason, JSON.stringify(tags), source]
  )
}

const upsertCooldown = async (connection, userId, platform, submissionId, lastSubmissionAt, cooldownUntil, reason) => {
  await connection.query(
    `INSERT INTO user_platform_cooldowns
     (user_id, platform, last_submission_id, last_submission_at, cooldown_until, cooldown_months, reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 3, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       last_submission_id = VALUES(last_submission_id),
       last_submission_at = VALUES(last_submission_at),
       cooldown_until = VALUES(cooldown_until),
       cooldown_months = VALUES(cooldown_months),
       reason = VALUES(reason),
       updated_at = NOW()`,
    [userId, platform, submissionId, lastSubmissionAt, cooldownUntil, reason]
  )
}

const upsertIdentityLinks = async (connection, userId, candidates, sourceRef) => {
  for (const candidate of candidates) {
    await connection.query(
      `INSERT INTO user_identity_links
       (user_id, identity_type, identity_hash, identity_value, source, source_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'submission', ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         identity_value = VALUES(identity_value),
         source = VALUES(source),
         source_ref = VALUES(source_ref),
         updated_at = NOW()`,
      [
        userId,
        candidate.type,
        candidate.hash,
        candidate.maskedValue,
        sourceRef
      ]
    )
  }
}

const findIdentityConflicts = async (connection, userId, candidates) => {
  const conflicts = []

  for (const candidate of candidates) {
    const [rows] = await connection.query(
      `SELECT user_id, identity_type, identity_hash
       FROM user_identity_links
       WHERE identity_type = ? AND identity_hash = ?`,
      [candidate.type, candidate.hash]
    )

    for (const row of rows) {
      if (parseInt(row.user_id, 10) !== parseInt(userId, 10)) {
        conflicts.push({
          user_id: parseInt(row.user_id, 10),
          identity_type: row.identity_type
        })
      }
    }
  }

  return conflicts
}

const buildSourceRef = (req) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || ''
  const deviceId = req.headers['x-device-id'] || ''
  return JSON.stringify({
    ip,
    device_id: deviceId
  })
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
    await db.transaction(async (connection) => {
      await syncExpiredTasks(connection)
    })

    const auth = await authenticateUser(req, res)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    const userId = auth.user.id
    const {
      task_id,
      wechat_id,
      phone_number,
      paid_amount,
      order_number,
      screenshot_search,
      screenshot_shop_1,
      screenshot_shop_2,
      screenshot_shop_3,
      screenshot_follow,
      screenshot_share,
      screenshot_detail,
      screenshot_cart,
      screenshot_paid_order,
      address_text,
      address,
      device_id,
      deviceId
    } = req.body

    if (
      !task_id ||
      !wechat_id ||
      !phone_number ||
      !paid_amount ||
      !order_number ||
      !screenshot_search ||
      !screenshot_shop_1 ||
      !screenshot_shop_2 ||
      !screenshot_shop_3 ||
      !screenshot_detail ||
      !screenshot_cart ||
      !screenshot_paid_order
    ) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少必填字段'))
    }

    const actualPaidAmount = parseFloat(paid_amount)
    if (Number.isNaN(actualPaidAmount) || actualPaidAmount <= 0) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '实付金额不正确'))
    }

    const result = await db.transaction(async (connection) => {
      const [taskRows] = await connection.query(
        'SELECT * FROM tasks WHERE id = ? FOR UPDATE',
        [task_id]
      )

      const task = taskRows[0]
      if (!task) {
        return { error: 'task_not_found' }
      }

      const socialRequired = isSocialPlatform(task.platform)
      if (socialRequired && (!screenshot_follow || !screenshot_share)) {
        return { error: 'social_required' }
      }

      const taskStatus = parsePositiveInt(task.status, 0)
      if (taskStatus !== 1) {
        return { error: 'task_closed' }
      }

      if (Number(task.remaining_quota || 0) <= 0) {
        return { error: 'quota_full' }
      }

      const now = new Date()
      const acceptStartTime = task.accept_start_time || task.start_time
      if (acceptStartTime && new Date(acceptStartTime) > now) {
        return { error: 'task_not_started' }
      }
      if (task.end_time && new Date(task.end_time) < now) {
        return { error: 'task_ended' }
      }

      const [existingRows] = await connection.query(
        'SELECT id FROM submissions WHERE task_id = ? AND user_id = ? FOR UPDATE',
        [task_id, userId]
      )
      if (existingRows.length > 0) {
        return { error: 'already_submitted' }
      }

      const [riskSnapshotBefore] = await connection.query(
        `SELECT status FROM user_risk_flags WHERE user_id = ? LIMIT 1`,
        [userId]
      )
      const currentRiskStatus = riskSnapshotBefore[0] ? parsePositiveInt(riskSnapshotBefore[0].status, 0) : 0
      if (currentRiskStatus === 1) {
        return { error: 'user_blocked' }
      }

      const identities = buildIdentityCandidates({
        user: auth.user,
        phoneNumber: phone_number,
        addressText: address_text || address || '',
        req,
        submissionId: null
      }).map(item => ({
        ...item,
        maskedValue: maskValue(item.value, item.type === 'ip' ? 2 : 3, item.type === 'device' ? 2 : 4)
      }))

      const identityConflicts = await findIdentityConflicts(connection, userId, identities)
      if (identityConflicts.length > 0) {
        const conflictTypes = [...new Set(identityConflicts.map(item => item.identity_type))]
        const reason = buildBlockedReason(
          buildIdentityConflictReason(conflictTypes, task.platform),
          conflictTypes
        )

        await upsertRiskFlag(connection, userId, reason, conflictTypes, 'submission')
        for (const conflict of identityConflicts) {
          await upsertRiskFlag(connection, conflict.user_id, reason, conflictTypes, 'submission')
        }

        return { error: 'identity_conflict' }
      }

      const [cooldownRows] = await connection.query(
        `SELECT id, created_at
         FROM submissions
         WHERE user_id = ? AND platform = ?
         ORDER BY created_at DESC
         LIMIT 1 FOR UPDATE`,
        [userId, task.platform]
      )

      const lastSubmission = cooldownRows[0]
      if (lastSubmission) {
        const lastSubmitTime = new Date(lastSubmission.created_at)
        const cooldownUntil = addMonths(lastSubmitTime, 3)
        if (cooldownUntil > now) {
          const reason = buildCooldownReason(task.platform, cooldownUntil)
          await upsertCooldown(
            connection,
            userId,
            task.platform,
            lastSubmission.id,
            lastSubmission.created_at,
            cooldownUntil,
            reason
          )
          return { error: 'platform_cooldown' }
        }
      }

      const encryptedPhone = encrypt(phone_number)
      const [insertResult] = await connection.query(
        `INSERT INTO submissions
         (task_id, user_id, platform, paid_amount, wechat_id, phone_number, order_number, screenshot_search, screenshot_shop_1,
          screenshot_shop_2, screenshot_shop_3, screenshot_follow, screenshot_share,
          screenshot_detail, screenshot_cart, screenshot_paid_order, address_text, reward_amount, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
        [
          task_id,
          userId,
          task.platform,
          actualPaidAmount,
          wechat_id,
          encryptedPhone,
          order_number,
          screenshot_search,
          screenshot_shop_1,
          screenshot_shop_2,
          screenshot_shop_3,
          socialRequired ? screenshot_follow : null,
          socialRequired ? screenshot_share : null,
          screenshot_detail,
          screenshot_cart,
          screenshot_paid_order,
          address_text || address || null,
          task.reward_amount
        ]
      )

      await connection.query(
        'UPDATE tasks SET remaining_quota = remaining_quota - 1 WHERE id = ?',
        [task_id]
      )

      await upsertIdentityLinks(connection, userId, identities, buildSourceRef(req))

      const cooldownUntil = addMonths(now, 3)
      await upsertCooldown(
        connection,
        userId,
        task.platform,
        insertResult.insertId,
        now.toISOString(),
        cooldownUntil,
        buildCooldownReason(task.platform, cooldownUntil)
      )

      return { submission_id: insertResult.insertId }
    })

    if (result && result.error) {
      if (result.error === 'task_not_found') {
        return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, '任务不存在'))
      }
      if (result.error === 'task_closed' || result.error === 'task_not_started' || result.error === 'task_ended') {
        return res.status(400).json(error(ErrorCodes.TASK_ENDED, '任务已结束'))
      }
      if (result.error === 'quota_full') {
        return res.status(400).json(error(ErrorCodes.QUOTA_FULL, '名额已满'))
      }
      if (result.error === 'social_required') {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '关注/分享截图为该平台必填'))
      }
      if (result.error === 'already_submitted') {
        return res.status(400).json(error(ErrorCodes.ALREADY_SUBMITTED, '已提交过该任务'))
      }
      if (result.error === 'platform_cooldown') {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '该平台三个月内只能接一次单'))
      }
      if (result.error === 'identity_conflict') {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '检测到统一用户，已禁止接单'))
      }
      if (result.error === 'user_blocked') {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '当前账号已被标记，禁止接单'))
      }
    }

    return res.json(success(result, '提交成功，等待审核'))
  } catch (err) {
    console.error('Submit task error:', err)
    if (err.message === 'invalid_amount') {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '实付金额不正确'))
    }

    return res.status(500).json(error(500, '服务器错误'))
  }
}
