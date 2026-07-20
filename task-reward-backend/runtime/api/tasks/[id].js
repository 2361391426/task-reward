const db = require('../../lib/db')
const { authenticateUser } = require('../../lib/auth')
const { success, error, ErrorCodes } = require('../../lib/response')
const { parsePositiveInt } = require('../../lib/pagination')
const { normalizeTaskRecord, syncExpiredTasks, getDraftExpireAt } = require('../../lib/task-lifecycle')

const normalizePlatform = (value) => {
  const platforms = ['douyin', 'xiaohongshu', 'taobao', 'jd']
  return platforms.includes(value) ? value : 'taobao'
}

const isSameDay = (a, b = new Date()) => {
  const left = a ? new Date(a) : null
  const right = b instanceof Date ? b : new Date(b)
  if (!left || Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

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
        await syncExpiredTasks(connection)

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
          `SELECT id, review_status, expires_at, released_at
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
            return {
              submission_id: existingRecord.id,
              expires_at: existingRecord.expires_at,
              reused: true
            }
          }
          if (recordStatus === -4 && existingRecord.released_at && isSameDay(existingRecord.released_at, now)) {
            return { error: 'task_cooldown' }
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
           VALUES (?, ?, ?, 0, '', '', '', '', '', '', '', '', '', '', '', '', NULL, NOW(), ?, -1, -1, '任务已开始', NOW(), 0, NOW(), NOW())`,
          [taskId, auth.user.id, task.platform, expiresAt]
        )

        return {
          submission_id: insertResult.insertId,
          expires_at: expiresAt
        }
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
        if (result.error === 'task_occupied') {
          return res.status(409).json(error(ErrorCodes.NO_PERMISSION, '任务已被他人暂时占用'))
        }
        if (result.error === 'task_cooldown') {
          return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '该任务今天已释放，今日不可再次接单'))
        }
        if (result.error === 'already_submitted') {
          return res.status(400).json(error(ErrorCodes.ALREADY_SUBMITTED, '已存在该任务记录'))
        }
      }

      return res.json(success(result, '任务已开始'))
    } catch (err) {
      console.error('Start task draft failed:', err)
      return res.status(500).json(error(500, '服务器错误'))
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json(error(405, 'Method not allowed'))
  }

  try {
    await db.transaction(async (connection) => {
      await syncExpiredTasks(connection)
    })

    const id = req.query.id ?? req.params?.id
    const taskId = parsePositiveInt(id, 0)
    if (!taskId) {
      return res.status(404).json(error(404, '任务不存在'))
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
      return res.status(404).json(error(404, '任务不存在'))
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
