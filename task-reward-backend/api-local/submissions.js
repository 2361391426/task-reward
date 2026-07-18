const express = require('express')
const router = express.Router()
const { query, queryOne, insert, update, withTransaction } = require('../lib/db-json')
const jwt = require('jsonwebtoken')
const { buildIdentityCandidates, buildIdentityConflictReason, buildCooldownReason } = require('../lib/fraud')

const success = (data) => ({ code: 0, data, message: 'success' })
const error = (message) => ({ code: -1, data: null, message })
const authError = (res, message = '未登录') => res.status(401).json(error(message))

const submissionLocks = new Set()
const normalizeStatus = (value) => {
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

const getMonthKey = (value) => {
  const date = new Date(value || Date.now())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

let lastSyncExpiredTasksAt = 0
const SYNC_THROTTLE_MS = 60 * 1000

const syncExpiredTasks = () => {
  const now = Date.now()
  if (now - lastSyncExpiredTasksAt < SYNC_THROTTLE_MS) {
    return
  }
  lastSyncExpiredTasksAt = now

  query('tasks')
    .filter(task => {
      const status = parseInt(task.status, 10)
      if (status !== 1 && status !== 2) return false
      if (!task.end_time) return false
      return new Date(task.end_time).getTime() <= now
    })
    .forEach(task => {
      update('tasks', { id: task.id }, { status: 3 })
    })

  query('submissions')
    .filter(submission =>
      parseInt(submission.review_status, 10) === -1 &&
      submission.expires_at &&
      new Date(submission.expires_at).getTime() <= now
    )
    .forEach(submission => {
      update('submissions', { id: submission.id }, {
        review_status: -4,
        status: -4,
        review_note: '该任务已超时释放',
        release_reason: '该任务已超时释放',
        released_at: new Date().toISOString()
      })
    })
}

const mapSubmission = (submission) => {
  const task = queryOne('tasks', { id: submission.task_id })
  const reviewStatus = normalizeStatus(submission.review_status ?? submission.status ?? 0)
  return {
    ...submission,
    platform: submission.platform || (task ? task.platform : 'taobao'),
    paid_amount: parseFloat(submission.paid_amount || 0),
    reward_amount: task ? parseFloat(task.reward_amount || 0) : parseFloat(submission.reward_amount || 0),
    task_title: task ? task.title : '',
    wechat_id: submission.wechat_id || '',
    phone_number: submission.phone_number || '',
    order_number: submission.order_number || '',
    address_text: submission.address_text || '',
    submit_time: submission.submit_time || submission.created_at,
    review_time: submission.review_time || submission.reviewed_at || '',
    review_note: submission.review_note || submission.reject_reason || '',
    review_status: reviewStatus,
    status: reviewStatus,
    month_key: submission.month_key || getMonthKey(submission.submit_time || submission.created_at),
    accepted_at: submission.accepted_at || null,
    expires_at: submission.expires_at || null,
    released_at: submission.released_at || null,
    release_reason: submission.release_reason || ''
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

const addMonths = (value, months) => {
  const date = new Date(value)
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

const getRiskSnapshot = (userId) => {
  const risk = queryOne('user_risk_flags', { user_id: userId })
  const cooldowns = query('user_platform_cooldowns', { user_id: userId })
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))

  return {
    status: risk ? normalizeStatus(risk.status) : 0,
    reason: risk?.risk_reason || '',
    tags: parseTags(risk?.risk_tags),
    blocked_at: risk?.blocked_at || null,
    cleared_at: risk?.cleared_at || null,
    cooldowns: cooldowns.map(item => ({
      platform: item.platform,
      last_submission_id: item.last_submission_id,
      last_submission_at: item.last_submission_at,
      cooldown_until: item.cooldown_until,
      cooldown_months: parseInt(item.cooldown_months, 10) || 3,
      reason: item.reason || ''
    }))
  }
}

const upsertRiskFlag = (tx, userId, reason, tags = [], source = 'submission') => {
  const existing = tx.queryOne('user_risk_flags', { user_id: userId })
  const payload = {
    user_id: userId,
    status: 1,
    risk_reason: reason,
    risk_tags: JSON.stringify(tags),
    source,
    blocked_at: new Date().toISOString(),
    cleared_at: null
  }

  if (existing) {
    tx.update('user_risk_flags', { user_id: userId }, payload)
    return existing.id
  }

  return tx.insert('user_risk_flags', payload).id
}

const upsertCooldown = (tx, userId, platform, submissionId, lastSubmissionAt, cooldownUntil, reason) => {
  const existing = tx.queryOne('user_platform_cooldowns', { user_id: userId, platform })
  const payload = {
    user_id: userId,
    platform,
    last_submission_id: submissionId,
    last_submission_at: lastSubmissionAt,
    cooldown_until: cooldownUntil.toISOString(),
    cooldown_months: 3,
    reason
  }

  if (existing) {
    tx.update('user_platform_cooldowns', { user_id: userId, platform }, payload)
    return existing.id
  }

  return tx.insert('user_platform_cooldowns', payload).id
}

const upsertIdentityLinks = (tx, userId, candidates, sourceRef) => {
  candidates.forEach(candidate => {
    const existing = tx.queryOne('user_identity_links', {
      identity_type: candidate.type,
      identity_hash: candidate.hash
    })

    const payload = {
      user_id: userId,
      identity_type: candidate.type,
      identity_hash: candidate.hash,
      identity_value: candidate.maskedValue,
      source: 'submission',
      source_ref: sourceRef
    }

    if (existing) {
      tx.update('user_identity_links', {
        identity_type: candidate.type,
        identity_hash: candidate.hash
      }, payload)
    } else {
      tx.insert('user_identity_links', payload)
    }
  })
}

const findIdentityConflicts = (tx, userId, candidates) => {
  const conflicts = []
  candidates.forEach(candidate => {
    const rows = tx.query('user_identity_links', {
      identity_type: candidate.type,
      identity_hash: candidate.hash
    })
    rows.forEach(row => {
      if (parseInt(row.user_id, 10) !== parseInt(userId, 10)) {
        conflicts.push({
          user_id: parseInt(row.user_id, 10),
          identity_type: row.identity_type
        })
      }
    })
  })
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

router.post('/', async (req, res) => {
  const lockKey = []
  try {
    syncExpiredTasks()
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return authError(res)
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret')
    } catch (err) {
      return authError(res, '登录已过期或无效')
    }
    const {
      task_id,
      wechat_id,
      phone_number,
      paid_amount,
      order_number,
      address_text,
      address,
      device_id,
      deviceId,
      screenshot_search,
      screenshot_shop_1,
      screenshot_shop_2,
      screenshot_shop_3,
      screenshot_follow,
      screenshot_share,
      screenshot_detail,
      screenshot_cart,
      screenshot_paid_order
    } = req.body

    const task = queryOne('tasks', { id: parseInt(task_id, 10) })
    const socialRequired = task ? ['douyin', 'xiaohongshu'].includes(task.platform) : false
    if (!task) {
      return res.json(error('Task not found'))
    }

    if (parseInt(task.status, 10) !== 1) {
      return res.json(error('Task has ended'))
    }
    const acceptStartTime = task.accept_start_time || task.start_time
    if (acceptStartTime && new Date(acceptStartTime) > new Date()) {
      return res.json(error('Task has not started yet'))
    }
    if (task.end_time && new Date(task.end_time) < new Date()) {
      update('tasks', { id: task.id }, { status: 3 })
      return res.json(error('Task has ended'))
    }

    const actualPaidAmount = parseFloat(paid_amount || 0)
    if (Number.isNaN(actualPaidAmount) || actualPaidAmount <= 0) {
      return res.json(error('Invalid paid amount'))
    }

    const requiredFields = [
      wechat_id,
      phone_number,
      order_number,
      screenshot_search,
      screenshot_shop_1,
      screenshot_shop_2,
      screenshot_shop_3,
      ...(socialRequired ? [screenshot_follow, screenshot_share] : []),
      screenshot_detail,
      screenshot_cart,
      screenshot_paid_order
    ]
    if (requiredFields.some(field => !field)) {
      return res.json(error('Missing required fields'))
    }

    const user = queryOne('users', { id: decoded.userId })
    if (!user) {
      return res.json(error('用户不存在'))
    }

    const identities = buildIdentityCandidates({
      user,
      phoneNumber: phone_number,
      addressText: address_text || address || '',
      req,
      submissionId: null
    }).map(item => ({
      ...item,
      maskedValue: item.type === 'device'
        ? `${String(item.value).slice(0, 2)}***`
        : item.type === 'ip'
          ? `${String(item.value).split('.').slice(0, 2).join('.')}.***`
          : String(item.value).slice(0, 3) + '***'
    }))

    const submissionKey = `create:${task_id}:${decoded.userId}`
    if (submissionLocks.has(submissionKey)) {
      return res.json(error('Request is already in progress'))
    }
    submissionLocks.add(submissionKey)
    lockKey.push(submissionKey)

    const submission = withTransaction(({ query: txQuery, queryOne: txQueryOne, insert: txInsert, update: txUpdate }) => {
      const existingRisk = txQueryOne('user_risk_flags', { user_id: decoded.userId })
      if (existingRisk && normalizeStatus(existingRisk.status, 0) === 1) {
        return { error: 'Current account is blocked' }
      }

      const existingInsideTx = txQuery('submissions').find(s =>
        s.task_id === parseInt(task_id, 10) && s.user_id === decoded.userId
      )
      if (existingInsideTx) {
        return { error: 'You have already submitted this task' }
      }

      const taskInsideTx = txQueryOne('tasks', { id: parseInt(task_id, 10) })
      if (!taskInsideTx) {
        return { error: 'Task not found' }
      }

      const conflicts = findIdentityConflicts({ query: txQuery }, decoded.userId, identities)
      if (conflicts.length > 0) {
        const conflictTypes = [...new Set(conflicts.map(item => item.identity_type))]
        const reason = buildIdentityConflictReason(conflictTypes, taskInsideTx.platform || 'taobao')
        upsertRiskFlag({ queryOne: txQueryOne, update: txUpdate, insert: txInsert }, decoded.userId, reason, conflictTypes, 'submission')
        conflicts.forEach(conflict => {
          upsertRiskFlag({ queryOne: txQueryOne, update: txUpdate, insert: txInsert }, conflict.user_id, reason, conflictTypes, 'submission')
        })
        return { error: reason }
      }

      const history = txQuery('submissions')
        .filter(item => item.user_id === decoded.userId && item.platform === (taskInsideTx.platform || 'taobao'))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      const lastSubmission = history[0]
      if (lastSubmission) {
        const cooldownUntil = addMonths(lastSubmission.created_at, 3)
        if (cooldownUntil > new Date()) {
          const reason = buildCooldownReason(taskInsideTx.platform || 'taobao', cooldownUntil)
          upsertCooldown(
            { queryOne: txQueryOne, update: txUpdate, insert: txInsert },
            decoded.userId,
            taskInsideTx.platform || 'taobao',
            lastSubmission.id,
            lastSubmission.created_at,
            cooldownUntil,
            reason
          )
          return { error: reason }
        }
      }

      const createdSubmission = txInsert('submissions', {
        task_id: parseInt(task_id, 10),
        user_id: decoded.userId,
        platform: taskInsideTx.platform || 'taobao',
        paid_amount: actualPaidAmount,
        wechat_id,
        address_text: address_text || address || '',
        month_key: getMonthKey(new Date()),
        phone_number,
        order_number,
        screenshot_search,
        screenshot_shop_1,
        screenshot_shop_2,
        screenshot_shop_3,
        screenshot_follow: socialRequired ? screenshot_follow : null,
        screenshot_share: socialRequired ? screenshot_share : null,
        screenshot_detail,
        screenshot_cart,
        screenshot_paid_order,
        address_text: address_text || address || '',
        status: 0,
        review_status: 0,
        review_note: '',
        submit_time: new Date().toISOString()
      })

      upsertIdentityLinks({ queryOne: txQueryOne, update: txUpdate, insert: txInsert, query: txQuery }, decoded.userId, identities, buildSourceRef(req))
      upsertCooldown(
        { queryOne: txQueryOne, update: txUpdate, insert: txInsert },
        decoded.userId,
        taskInsideTx.platform || 'taobao',
        createdSubmission.id,
        createdSubmission.created_at,
        addMonths(createdSubmission.created_at, 3),
        `${taskInsideTx.platform || '当前'}平台三个月内只能接一次单`
      )

      txUpdate('tasks', { id: parseInt(task_id, 10) }, {
        used_quota: (taskInsideTx.used_quota || 0) + 1
      })

      return createdSubmission
    })

    if (submission && submission.error) {
      return res.json(error(submission.error))
    }

    res.json(success({ submission_id: submission.id }))
  } catch (err) {
    console.error('Submit task failed:', err)
    res.json(error('Submit task failed'))
  } finally {
    lockKey.forEach(key => submissionLocks.delete(key))
  }
})

router.get('/my', async (req, res) => {
  try {
    syncExpiredTasks()
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return authError(res)
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret')
    } catch (err) {
      return authError(res, '登录已过期或无效')
    }
    const taskIds = String(req.query.task_ids || '')
      .split(',')
      .map(item => parseInt(item, 10))
      .filter(item => Number.isFinite(item) && item > 0)

    let submissions = query('submissions', { user_id: decoded.userId })
    if (taskIds.length > 0) {
      const taskIdSet = new Set(taskIds)
      submissions = submissions.filter(item => taskIdSet.has(parseInt(item.task_id, 10)))
    }
    submissions = submissions
      .filter(item => parseInt(item.status, 10) !== -4)
      .map(mapSubmission)
      .sort((a, b) => new Date(b.submit_time) - new Date(a.submit_time))

    res.json(success({ list: submissions }))
  } catch (err) {
    console.error('Get submissions failed:', err)
    res.json(error('Get submissions failed'))
  }
})

router.get('/:id', async (req, res) => {
  try {
    syncExpiredTasks()
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return authError(res)
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret')
    } catch (err) {
      return authError(res, '登录已过期或无效')
    }
    const { id } = req.params

    const submission = queryOne('submissions', { id: parseInt(id, 10) })
    if (!submission) {
      return res.json(error('Submission not found'))
    }

    if (decoded.type === 'merchant' || decoded.type === 'merchant_staff') {
      const task = queryOne('tasks', { id: submission.task_id })
      if (!task || parseInt(task.merchant_id, 10) !== parseInt(decoded.merchantId || decoded.user_id, 10)) {
        return res.json(error('No permission'))
      }
    } else if (submission.user_id !== decoded.userId) {
      return res.json(error('No permission'))
    }

    res.json(success(mapSubmission(submission)))
  } catch (err) {
    console.error('Get submission detail failed:', err)
    res.json(error('Get submission detail failed'))
  }
})

router.put('/:id', async (req, res) => {
  const lockKey = []
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return authError(res)
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret')
    } catch (err) {
      return authError(res, '登录已过期或无效')
    }
    const { id } = req.params
    const submissionId = parseInt(id, 10)
    const lockName = `resubmit:${submissionId}:${decoded.userId}`
    if (submissionLocks.has(lockName)) {
      return res.json(error('Request is already in progress'))
    }
    submissionLocks.add(lockName)
    lockKey.push(lockName)

    const submission = queryOne('submissions', { id: submissionId })
    if (!submission) {
      return res.json(error('Submission not found'))
    }

    if (submission.user_id !== decoded.userId) {
      return res.json(error('No permission'))
    }

    const risk = queryOne('user_risk_flags', { user_id: decoded.userId })
    if (risk && normalizeStatus(risk.status, 0) === 1) {
      return res.json(error('Current account is blocked'))
    }

    const currentStatus = normalizeStatus(submission.review_status ?? submission.status ?? 0)
    if (currentStatus !== 2 && currentStatus !== -1) {
      return res.json(error('Current status does not allow resubmission'))
    }

    if (currentStatus === -1 && submission.expires_at && new Date(submission.expires_at) <= new Date()) {
      return res.json(error('Task has expired'))
    }

    const task = queryOne('tasks', { id: submission.task_id })
    const socialRequired = task ? ['douyin', 'xiaohongshu'].includes(task.platform || 'taobao') : false
    if (!task || parseInt(task.status, 10) !== 1 || (task.end_time && new Date(task.end_time) < new Date())) {
      return res.json(error('Task has ended'))
    }

    const {
      wechat_id,
      phone_number,
      paid_amount,
      order_number,
      address_text,
      address,
      screenshot_search,
      screenshot_shop_1,
      screenshot_shop_2,
      screenshot_shop_3,
      screenshot_follow,
      screenshot_share,
      screenshot_detail,
      screenshot_cart,
      screenshot_paid_order
    } = req.body

    const actualPaidAmount = parseFloat(paid_amount || submission.paid_amount || 0)
    if (Number.isNaN(actualPaidAmount) || actualPaidAmount <= 0) {
      return res.json(error('Invalid paid amount'))
    }

    const requiredFields = [
      wechat_id,
      phone_number,
      order_number,
      screenshot_search,
      screenshot_shop_1,
      screenshot_shop_2,
      screenshot_shop_3,
      ...(socialRequired ? [screenshot_follow, screenshot_share] : []),
      screenshot_detail,
      screenshot_cart,
      screenshot_paid_order
    ]
    if (requiredFields.some(field => !field)) {
      return res.json(error('Missing required fields'))
    }

    update('submissions', { id: submissionId }, {
      wechat_id,
      phone_number,
      order_number,
      address_text: address_text || address || '',
      paid_amount: actualPaidAmount,
      screenshot_search,
      screenshot_shop_1,
      screenshot_shop_2,
      screenshot_shop_3,
      screenshot_follow: socialRequired ? screenshot_follow : null,
      screenshot_share: socialRequired ? screenshot_share : null,
      screenshot_detail,
      screenshot_cart,
      screenshot_paid_order,
      status: 0,
      review_status: 0,
      review_note: '',
      review_time: '',
      accepted_at: submission.accepted_at || new Date().toISOString(),
      released_at: null,
      release_reason: ''
    })

    if (currentStatus === -1) {
      update('tasks', { id: submission.task_id }, {
        remaining_quota: Math.max((queryOne('tasks', { id: submission.task_id })?.remaining_quota || 0) - 1, 0)
      })
    }

    res.json(success({ submission_id: submissionId }))
  } catch (err) {
    console.error('Resubmit failed:', err)
    res.json(error('Resubmit failed'))
  } finally {
    lockKey.forEach(key => submissionLocks.delete(key))
  }
})

module.exports = router
