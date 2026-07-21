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

const isSameDay = (a, b = new Date()) => {
  const left = a ? new Date(a) : null
  const right = b instanceof Date ? b : new Date(b)
  if (!left || Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
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
    return res.status(405).json(error(405, '请求方法不支持'))
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

      await connection.query(
        `UPDATE submissions
         SET review_status = -4,
             status = -4,
             release_reason = '项目超时自动释放',
             released_at = NOW(),
             review_note = '项目超时自动释放',
             updated_at = NOW()
         WHERE task_id = ?
           AND user_id = ?
           AND review_status = -1
           AND expires_at IS NOT NULL
           AND expires_at <= NOW()`,
        [task_id, userId]
      )

      const [existingRows] = await connection.query(
        `SELECT id, review_status, expires_at, released_at
         FROM submissions
         WHERE task_id = ? AND user_id = ?
         ORDER BY created_at DESC
         LIMIT 1 FOR UPDATE`,
        [task_id, userId]
      )
      const existingSubmission = existingRows[0] || null
      if (!existingSubmission) {
        return { error: 'no_active_claim' }
      }

      const existingStatus = parsePositiveInt(existingSubmission.review_status, 0)
      if (existingStatus === -4 && existingSubmission.released_at && isSameDay(existingSubmission.released_at, now)) {
        return { error: 'task_cooldown' }
      }
      if (
        existingStatus !== -1 ||
        !existingSubmission.expires_at ||
        new Date(existingSubmission.expires_at) <= now
      ) {
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
         WHERE user_id = ?
           AND platform = ?
           AND id <> ?
           AND review_status IN (0, 1, 2)
         ORDER BY created_at DESC
         LIMIT 1 FOR UPDATE`,
        [userId, task.platform, existingSubmission.id]
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
      await connection.query(
        `UPDATE submissions
         SET platform = ?,
             paid_amount = ?,
             wechat_id = ?,
             phone_number = ?,
             order_number = ?,
             screenshot_search = ?,
             screenshot_shop_1 = ?,
             screenshot_shop_2 = ?,
             screenshot_shop_3 = ?,
             screenshot_follow = ?,
             screenshot_share = ?,
             screenshot_detail = ?,
             screenshot_cart = ?,
             screenshot_paid_order = ?,
             address_text = ?,
             reward_amount = ?,
             review_status = 0,
             status = 0,
             review_note = '',
             submit_time = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [
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
          task.reward_amount,
          existingSubmission.id
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
        existingSubmission.id,
        now.toISOString(),
        cooldownUntil,
        buildCooldownReason(task.platform, cooldownUntil)
      )

      return { submission_id: existingSubmission.id }
    })

    if (result && result.error) {
      if (result.error === 'task_not_found') {
        return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, '项目不存在'))
      }
      if (result.error === 'task_closed' || result.error === 'task_not_started' || result.error === 'task_ended') {
        return res.status(400).json(error(ErrorCodes.TASK_ENDED, '项目暂不可参与'))
      }
      if (result.error === 'quota_full') {
        return res.status(400).json(error(ErrorCodes.QUOTA_FULL, '名额已满'))
      }
      if (result.error === 'social_required') {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '关注/分享截图为该平台必填'))
      }
      if (result.error === 'already_submitted') {
        return res.status(400).json(error(ErrorCodes.ALREADY_SUBMITTED, '已提交过该项目'))
      }
      if (result.error === 'no_active_claim') {
        return res.status(409).json(error(ErrorCodes.NO_PERMISSION, '请先开始项目后再提交审核'))
      }
      if (result.error === 'task_cooldown') {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '该项目今天已释放，今日不能再次参与'))
      }
      if (result.error === 'platform_cooldown') {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '该平台三个月内已有参与记录'))
      }
      if (result.error === 'identity_conflict') {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '检测到统一用户，暂不可参与'))
      }
      if (result.error === 'user_blocked') {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '当前账号已被标记，暂不可参与'))
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
