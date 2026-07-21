const db = require('../../lib/db')
const cache = require('../../lib/cache')
const { authenticateUser } = require('../../lib/auth')
const { success, error, ErrorCodes } = require('../../lib/response')
const { parsePositiveInt } = require('../../lib/pagination')
const { normalizeTaskRecord, getDraftExpireAt } = require('../../lib/task-lifecycle')
const { notifyTaskStarted } = require('../../lib/wechat-notify')
const {
  buildIdentityCandidates,
  buildIdentityConflictReason,
  buildCooldownReason,
  buildBlockedReason,
  maskValue
} = require('../../lib/fraud')

const normalizePlatform = (value) => {
  const platforms = ['douyin', 'xiaohongshu', 'taobao', 'jd']
  return platforms.includes(value) ? value : 'taobao'
}

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

const upsertRiskFlag = async (connection, userId, reason, tags = [], source = 'claim') => {
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
       VALUES (?, ?, ?, ?, 'claim', ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         identity_value = VALUES(identity_value),
         source = VALUES(source),
         source_ref = VALUES(source_ref),
         updated_at = NOW()`,
      [userId, candidate.type, candidate.hash, candidate.maskedValue, sourceRef]
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
  const deviceId = req.headers['x-device-id'] || req.body?.device_id || req.body?.deviceId || ''
  return JSON.stringify({
    ip,
    device_id: deviceId
  })
}

const resetReleasedSubmission = async (connection, submissionId, platform, expiresAt) => {
  await connection.query(
    `UPDATE submissions
     SET platform = ?,
         paid_amount = 0,
         wechat_id = '',
         phone_number = '',
         order_number = '',
         screenshot_search = '',
         screenshot_shop_1 = '',
         screenshot_shop_2 = '',
         screenshot_shop_3 = '',
         screenshot_follow = '',
         screenshot_share = '',
         screenshot_detail = '',
         screenshot_cart = '',
         screenshot_paid_order = '',
         address_text = NULL,
         accepted_at = NOW(),
         expires_at = ?,
         released_at = NULL,
         release_reason = NULL,
         review_status = -1,
         status = -1,
         review_note = '项目已开始',
         submit_time = NOW(),
         reward_amount = 0,
         updated_at = NOW()
     WHERE id = ?`,
    [platform, expiresAt, submissionId]
  )
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'POST') {
    const auth = await authenticateUser(req, res)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    try {
      const result = await db.transaction(async (connection) => {
        const taskId = parsePositiveInt(req.query.id ?? req.params?.id, 0)
        if (!taskId) {
          return { error: 'task_not_found' }
        }

        const [taskRows] = await connection.query(
          `SELECT id, platform, status, remaining_quota, start_time, accept_start_time, end_time, reward_amount, title
           FROM tasks
           WHERE id = ?
           FOR UPDATE`,
          [taskId]
        )
        const task = taskRows[0]
        if (!task) {
          return { error: 'task_not_found' }
        }

        const now = new Date()
        const acceptStartTime = task.accept_start_time || task.start_time
        if (parsePositiveInt(task.status, 0) !== 1) {
          return { error: 'task_closed' }
        }
        if (Number(task.remaining_quota || 0) <= 0) {
          return { error: 'quota_full' }
        }
        if (acceptStartTime && new Date(acceptStartTime) > now) {
          return { error: 'task_not_started' }
        }
        if (task.end_time && new Date(task.end_time) < now) {
          return { error: 'task_ended' }
        }

        const [riskRows] = await connection.query(
          `SELECT status
           FROM user_risk_flags
           WHERE user_id = ?
           LIMIT 1`,
          [auth.user.id]
        )
        if (riskRows[0] && parsePositiveInt(riskRows[0].status, 0) === 1) {
          return { error: 'user_blocked' }
        }

        const [cooldownRows] = await connection.query(
          `SELECT id, last_submission_id, last_submission_at, cooldown_until, reason
           FROM user_platform_cooldowns
           WHERE user_id = ?
             AND platform = ?
             AND cooldown_until IS NOT NULL
             AND cooldown_until > NOW()
           ORDER BY cooldown_until DESC
           LIMIT 1 FOR UPDATE`,
          [auth.user.id, task.platform]
        )
        if (cooldownRows[0]) {
          return { error: 'platform_cooldown' }
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
          [taskId, auth.user.id]
        )

        const identities = buildIdentityCandidates({
          user: auth.user,
          req,
          submissionId: null
        }).map(item => ({
          ...item,
          maskedValue: maskValue(item.value, item.type === 'ip' ? 2 : 3, item.type === 'device' ? 2 : 4)
        }))

        const identityConflicts = await findIdentityConflicts(connection, auth.user.id, identities)
        if (identityConflicts.length > 0) {
          const conflictTypes = [...new Set(identityConflicts.map(item => item.identity_type))]
          const reason = buildBlockedReason(
            buildIdentityConflictReason(conflictTypes, task.platform),
            conflictTypes
          )

          await upsertRiskFlag(connection, auth.user.id, reason, conflictTypes, 'claim')
          for (const conflict of identityConflicts) {
            await upsertRiskFlag(connection, conflict.user_id, reason, conflictTypes, 'claim')
          }
          return { error: 'identity_conflict' }
        }

        const [recentRows] = await connection.query(
          `SELECT id, created_at
           FROM submissions
           WHERE user_id = ?
             AND platform = ?
             AND review_status IN (0, 1, 2)
           ORDER BY created_at DESC
           LIMIT 1 FOR UPDATE`,
          [auth.user.id, task.platform]
        )
        if (recentRows[0]) {
          const cooldownUntil = addMonths(recentRows[0].created_at, 3)
          if (cooldownUntil > now) {
            const reason = buildCooldownReason(task.platform, cooldownUntil)
            await upsertCooldown(
              connection,
              auth.user.id,
              task.platform,
              recentRows[0].id,
              recentRows[0].created_at,
              cooldownUntil,
              reason
            )
            return { error: 'platform_cooldown' }
          }
        }

        const [activeRows] = await connection.query(
          `SELECT id, user_id, expires_at
           FROM submissions
           WHERE task_id = ?
             AND review_status = -1
             AND expires_at IS NOT NULL
             AND expires_at > NOW()
           ORDER BY expires_at DESC
           LIMIT 1 FOR UPDATE`,
          [taskId]
        )
        const activeClaim = activeRows[0] || null
        if (activeClaim && parsePositiveInt(activeClaim.user_id, 0) !== parsePositiveInt(auth.user.id, 0)) {
          return { error: 'task_occupied', expires_at: activeClaim.expires_at }
        }

        const [userRows] = await connection.query(
          `SELECT id, user_id, review_status, expires_at, released_at
           FROM submissions
           WHERE task_id = ? AND user_id = ?
           ORDER BY created_at DESC
           LIMIT 1 FOR UPDATE`,
          [taskId, auth.user.id]
        )
        const existingRecord = userRows[0] || null
        if (existingRecord) {
          const recordStatus = parsePositiveInt(existingRecord.review_status, 0)
          if (recordStatus === -1 && existingRecord.expires_at && new Date(existingRecord.expires_at) > now) {
            await upsertIdentityLinks(connection, auth.user.id, identities, buildSourceRef(req))
            return {
              submission_id: existingRecord.id,
              task_id: task.id,
              task_title: task.title,
              user_id: auth.user.id,
              expires_at: existingRecord.expires_at,
              reused: true
            }
          }
          if (recordStatus === -4 && existingRecord.released_at && isSameDay(existingRecord.released_at, now)) {
            return { error: 'task_cooldown' }
          }
          if (recordStatus === -4) {
            const expiresAt = getDraftExpireAt(now).toISOString()
            await resetReleasedSubmission(connection, existingRecord.id, task.platform, expiresAt)
            await upsertIdentityLinks(connection, auth.user.id, identities, buildSourceRef(req))
            return {
              submission_id: existingRecord.id,
              task_id: task.id,
              task_title: task.title,
              user_id: auth.user.id,
              expires_at: expiresAt,
              reused: false
            }
          }
          if (recordStatus === 0 || recordStatus === 1 || recordStatus === 2) {
            return { error: 'already_submitted' }
          }
        }

        const expiresAt = getDraftExpireAt(now).toISOString()
        const [insertResult] = await connection.query(
          `INSERT INTO submissions
           (task_id, user_id, platform, paid_amount, wechat_id, phone_number, order_number, screenshot_search, screenshot_shop_1,
            screenshot_shop_2, screenshot_shop_3, screenshot_follow, screenshot_share,
            screenshot_detail, screenshot_cart, screenshot_paid_order, address_text, accepted_at, expires_at,
            review_status, status, review_note, submit_time, reward_amount, created_at, updated_at)
           VALUES (?, ?, ?, 0, '', '', '', '', '', '', '', '', '', '', '', '', NULL, NOW(), ?, -1, -1, '项目已开始', NOW(), 0, NOW(), NOW())`,
          [taskId, auth.user.id, task.platform, expiresAt]
        )

        await upsertIdentityLinks(connection, auth.user.id, identities, buildSourceRef(req))

        return {
          submission_id: insertResult.insertId,
          task_id: task.id,
          task_title: task.title,
          user_id: auth.user.id,
          expires_at: expiresAt,
          reused: false
        }
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
        if (result.error === 'task_occupied') {
          return res.status(409).json(error(ErrorCodes.NO_PERMISSION, '该项目名额已被暂时占用'))
        }
        if (result.error === 'task_cooldown') {
          return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '该项目今天已释放，今日不能再次参与'))
        }
        if (result.error === 'already_submitted') {
          return res.status(400).json(error(ErrorCodes.ALREADY_SUBMITTED, '已存在该项目记录'))
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

      if (result && !result.error) {
        cache.clearByPrefix('tasks:list:')
        if (!result.reused) {
          notifyTaskStarted({
            userId: result.user_id,
            submissionId: result.submission_id,
            taskTitle: result.task_title,
            expiresAt: result.expires_at
          }).catch((err) => {
            console.warn('[tasks] 发送项目开始订阅消息失败:', err.message)
          })
        }
      }

      return res.json(success(result, '项目已开始'))
    } catch (err) {
      console.error('Start task draft failed:', err)
      return res.status(500).json(error(500, '服务器错误'))
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json(error(405, '请求方法不支持'))
  }

  try {
    const id = req.query.id ?? req.params?.id
    const taskId = parsePositiveInt(id, 0)
    if (!taskId) {
      return res.status(404).json(error(404, '项目不存在'))
    }

    const task = await db.queryOne(
      `SELECT id, platform, title, description, reward_amount, total_quota, remaining_quota,
              status, search_keyword, shop_name, product_name, product_link, requirements,
              start_time, accept_start_time, end_time, created_at
       FROM tasks
       WHERE id = ?`,
      [taskId]
    )

    if (!task) {
      return res.status(404).json(error(404, '项目不存在'))
    }

    const activeClaim = await db.queryOne(
      `SELECT user_id, expires_at
       FROM submissions
       WHERE task_id = ?
         AND review_status = -1
         AND expires_at IS NOT NULL
         AND expires_at > NOW()
       ORDER BY expires_at DESC
       LIMIT 1`,
      [taskId]
    )

    res.json(success({
      ...normalizeTaskRecord({
        ...task,
        platform: normalizePlatform(task.platform),
        reward_amount: parseFloat(task.reward_amount),
        status: parsePositiveInt(task.status, 1)
      }),
      product_name: task.product_name || '',
      claim_status: activeClaim ? 'occupied' : 'available',
      claim_expires_at: activeClaim?.expires_at || null
    }))
  } catch (err) {
    console.error('Get task detail error:', err)
    res.status(500).json(error(500, '服务器错误'))
  }
}
