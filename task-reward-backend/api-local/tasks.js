const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { query, queryOne, update, insert } = require('../lib/db-json')

const success = (data) => ({ code: 0, data, message: 'success' })
const error = (message) => ({ code: -1, data: null, message })

const DRAFT_TTL_MS = 60 * 60 * 1000
const COOLDOWN_REASON = '该任务今天已释放，今日不可再次接单'

const normalizeTask = (task) => ({
  ...task,
  reward_amount: parseFloat(task.reward_amount || 0),
  platform: task.platform || 'taobao',
  product_name: task.product_name || task.product_link || '',
  status: parseInt(task.status, 10) || 1
})

const normalizeStatus = (value, fallback = 1) => {
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const getRemainingQuota = (task) => {
  if (!task) return 0
  const totalQuota = parseInt(task.total_quota, 10) || 0
  const usedQuota = parseInt(task.used_quota, 10) || 0
  const explicitRemaining = parseInt(task.remaining_quota, 10)
  if (!Number.isNaN(explicitRemaining)) {
    return Math.max(explicitRemaining, 0)
  }
  return Math.max(totalQuota - usedQuota, 0)
}

const isTaskAvailable = (task, now = new Date()) => {
  if (parseInt(task.status, 10) !== 1) return false
  if (getRemainingQuota(task) <= 0) return false
  if (task.start_time && new Date(task.start_time) > now) return false
  if (task.end_time && new Date(task.end_time) < now) return false

  const activeDraft = query('submissions').find(submission =>
    parseInt(submission.task_id, 10) === parseInt(task.id, 10) &&
    parseInt(submission.review_status, 10) === -1 &&
    submission.expires_at &&
    new Date(submission.expires_at).getTime() > now.getTime()
  )

  return !activeDraft
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
        review_note: COOLDOWN_REASON,
        release_reason: COOLDOWN_REASON,
        released_at: new Date().toISOString()
      })
    })
}

const getClaimInfo = (taskId) => {
  const active = query('submissions').find(submission =>
    parseInt(submission.task_id, 10) === parseInt(taskId, 10) &&
    parseInt(submission.review_status, 10) === -1 &&
    submission.expires_at &&
    new Date(submission.expires_at).getTime() > Date.now()
  )
  return active ? {
    status: 'occupied',
    expires_at: active.expires_at,
    user_id: active.user_id
  } : {
    status: 'available',
    expires_at: null,
    user_id: null
  }
}

router.post('/:id', async (req, res) => {
  try {
    syncExpiredTasks()
    const taskId = parseInt(req.params.id, 10)
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.json(error('未登录'))
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret')
    } catch (err) {
      return res.json(error('登录已过期或无效'))
    }
    const userId = parseInt(decoded.userId, 10)

    const task = queryOne('tasks', { id: taskId })
    if (!task) {
      return res.json(error('Task not found'))
    }

    if (parseInt(task.status, 10) !== 1) {
      return res.json(error('Task has ended'))
    }

    if (getRemainingQuota(task) <= 0) {
      return res.json(error('任务名额已满'))
    }

    const now = new Date()
    const acceptStartTime = task.accept_start_time || task.start_time
    if (acceptStartTime && new Date(acceptStartTime) > now) {
      return res.json(error('Task has not started yet'))
    }
    if (task.end_time && new Date(task.end_time) < now) {
      update('tasks', { id: task.id }, { status: 3 })
      return res.json(error('Task has ended'))
    }

    const activeDraft = query('submissions').find(submission =>
      parseInt(submission.task_id, 10) === taskId &&
      parseInt(submission.review_status, 10) === -1 &&
      submission.expires_at &&
      new Date(submission.expires_at).getTime() > now.getTime()
    )

    if (activeDraft && parseInt(activeDraft.user_id, 10) !== userId) {
      return res.json(error('Task occupied'))
    }

    const ownDraft = query('submissions').find(submission =>
      parseInt(submission.task_id, 10) === taskId &&
      parseInt(submission.user_id, 10) === userId
    )

    if (ownDraft) {
      const ownStatus = parseInt(ownDraft.review_status, 10)
      if (ownStatus === -1 && ownDraft.expires_at && new Date(ownDraft.expires_at).getTime() > now.getTime()) {
        return res.json(success({ submission_id: ownDraft.id, expires_at: ownDraft.expires_at }))
      }
      if (ownStatus === -4 && ownDraft.released_at) {
        const releasedDay = new Date(ownDraft.released_at)
        if (releasedDay.toDateString() === now.toDateString()) {
          return res.json(error(COOLDOWN_REASON))
        }
      }
      if (ownStatus === 0 || ownStatus === 1 || ownStatus === 2) {
        return res.json(error('You have already submitted this task'))
      }
    }

    const expiresAt = new Date(now.getTime() + DRAFT_TTL_MS).toISOString()
    const draft = insert('submissions', {
      task_id: taskId,
      user_id: userId,
      task_title: task.title,
      platform: task.platform,
      paid_amount: 0,
      wechat_id: '',
      phone_number: '',
      order_number: '',
      screenshot_search: '',
      screenshot_shop_1: '',
      screenshot_shop_2: '',
      screenshot_shop_3: '',
      screenshot_follow: '',
      screenshot_share: '',
      screenshot_detail: '',
      screenshot_cart: '',
      screenshot_paid_order: '',
      address_text: '',
      accepted_at: now.toISOString(),
      expires_at: expiresAt,
      released_at: null,
      release_reason: '',
      review_status: -1,
      status: -1,
      review_note: '任务已开始',
      submit_time: now.toISOString(),
      reward_amount: parseFloat(task.reward_amount || 0)
    })

    res.json(success({ submission_id: draft.id, expires_at: expiresAt }))
  } catch (err) {
    console.error('Claim task failed:', err)
    res.json(error('Claim task failed'))
  }
})

router.get('/', async (req, res) => {
  try {
    syncExpiredTasks()
    const { page = 1, page_size = 10, status = 1, platform } = req.query

    const now = new Date()
    let tasks = query('tasks')
      .filter(item => normalizeStatus(item.status) === normalizeStatus(status))
      .filter(item => isTaskAvailable(item, now))

    if (platform) {
      tasks = tasks.filter(item => item.platform === platform)
    }

    tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const total = tasks.length
    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(page_size, 10) || 10, 1), 50)
    const offset = (pageNum - 1) * pageSize
    const list = tasks.slice(offset, offset + pageSize).map(normalizeTask)

    res.json(success({
      list,
      total,
      page: pageNum,
      page_size: pageSize
    }))
  } catch (err) {
    console.error('获取任务列表失败:', err)
    res.json(error('获取任务列表失败'))
  }
})

router.get('/:id', async (req, res) => {
  try {
    syncExpiredTasks()
    const { id } = req.params
    const task = queryOne('tasks', { id: parseInt(id, 10) })

    if (!task) {
      return res.json(error('任务不存在'))
    }

    res.json(success({
      ...normalizeTask(task),
      claim_status: getClaimInfo(id).status,
      claim_expires_at: getClaimInfo(id).expires_at
    }))
  } catch (err) {
    console.error('获取任务详情失败:', err)
    res.json(error('获取任务详情失败'))
  }
})

module.exports = router
module.exports.syncExpiredTasks = syncExpiredTasks
