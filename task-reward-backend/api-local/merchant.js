const express = require('express')
const router = express.Router()
const { query, queryOne, insert, update, withTransaction } = require('../lib/db-json')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const success = (data) => ({ code: 0, data, message: 'success' })
const error = (message) => ({ code: -1, data: null, message })
const authError = (res, message = 'Not logged in') => res.status(401).json(error(message))

const loginAttempts = new Map()
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_LOCK_MS = 15 * 60 * 1000

const getMonthKey = (value) => {
  const date = new Date(value || Date.now())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

const normalizePlatform = (value) => {
  const platforms = ['douyin', 'xiaohongshu', 'taobao', 'jd']
  return platforms.includes(value) ? value : 'taobao'
}

const normalizeTaskStatus = (value) => {
  const parsed = parseInt(value, 10)
  return [1, 2, 3].includes(parsed) ? parsed : null
}

const normalizeWithdrawStatus = (value) => {
  const parsed = parseInt(value, 10)
  return [0, 1, 2].includes(parsed) ? parsed : null
}

const normalizePaymentMethod = (value) => {
  const parsed = parseInt(value, 10)
  return [1, 2, 3].includes(parsed) ? parsed : 1
}

const normalizeStatus = (value, fallback = 0) => {
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const requireMerchant = (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    authError(res)
    return null
  }

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret')
  } catch (err) {
    authError(res, 'Token invalid or expired')
    return null
  }

  const merchant = queryOne('merchants', { id: decoded.merchantId })
  if (!merchant) {
    authError(res, 'Merchant not found or disabled')
    return null
  }

  return { merchant, decoded }
}

const safeDecrypt = (value) => {
  if (!value) return ''
  try {
    const { decrypt } = require('../lib/crypto')
    return decrypt(value)
  } catch (err) {
    return value
  }
}

const formatTask = (task) => ({
  ...task,
  platform: normalizePlatform(task.platform),
  reward_amount: parseFloat(task.reward_amount || 0)
})

const formatSubmission = (submission) => {
  const task = queryOne('tasks', { id: submission.task_id })
  const reviewStatus = normalizeStatus(submission.review_status ?? submission.status ?? 0)
  return {
    ...submission,
    platform: submission.platform || (task ? task.platform : 'taobao'),
    paid_amount: parseFloat(submission.paid_amount || 0),
    reward_amount: task ? parseFloat(task.reward_amount || 0) : parseFloat(submission.reward_amount || 0),
    task_title: task ? task.title : '',
    review_status: reviewStatus,
    status: reviewStatus,
    month_key: submission.month_key || getMonthKey(submission.submit_time || submission.created_at)
  }
}

const buildPlatformStats = (monthKey, merchantId) => {
  const tasks = query('tasks', merchantId ? { merchant_id: merchantId } : {}).map(formatTask)
  const taskIds = new Set(tasks.map(item => item.id))
  const submissions = query('submissions')
    .filter(item => !merchantId || taskIds.has(item.task_id))
    .map(formatSubmission)
  const filtered = submissions.filter(item => {
    if (!monthKey) return true
    const itemMonth = item.month_key || getMonthKey(item.submit_time)
    return itemMonth === monthKey
  })

  const platforms = ['douyin', 'xiaohongshu', 'taobao', 'jd']
  return platforms.map(platform => {
    const taskCount = tasks.filter(item => item.platform === platform).length
    const platformSubs = filtered.filter(item => item.platform === platform)
    return {
      platform,
      month_key: monthKey || '',
      task_count: taskCount,
      submission_count: platformSubs.length,
      pending_count: platformSubs.filter(item => normalizeStatus(item.review_status) === 0).length,
      approved_count: platformSubs.filter(item => normalizeStatus(item.review_status) === 1).length,
      rejected_count: platformSubs.filter(item => normalizeStatus(item.review_status) === 2).length,
      total_paid_amount: platformSubs.reduce((sum, item) => sum + parseFloat(item.paid_amount || 0), 0).toFixed(2),
      total_reward_amount: platformSubs.reduce((sum, item) => sum + parseFloat(item.reward_amount || 0), 0).toFixed(2)
    }
  })
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

const getUserRiskSnapshot = (userId) => {
  const risk = queryOne('user_risk_flags', { user_id: userId })
  const cooldowns = query('user_platform_cooldowns', { user_id: userId })
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
  const identityLinks = query('user_identity_links', { user_id: userId })

  return {
    risk_status: risk ? normalizeStatus(risk.status, 0) : 0,
    risk_reason: risk?.risk_reason || '',
    risk_tags: parseTags(risk?.risk_tags),
    blocked_at: risk?.blocked_at || null,
    cleared_at: risk?.cleared_at || null,
    platform_cooldowns: cooldowns.map(item => ({
      platform: item.platform,
      last_submission_id: item.last_submission_id,
      last_submission_at: item.last_submission_at,
      cooldown_until: item.cooldown_until,
      cooldown_months: normalizeStatus(item.cooldown_months, 3) || 3,
      reason: item.reason || ''
    })),
    identity_types: [...new Set(identityLinks.map(item => item.identity_type).filter(Boolean))],
    identity_count: identityLinks.length
  }
}

const setRiskFlag = (userId, status, reason, tags = [], source = 'merchant') => {
  const existing = queryOne('user_risk_flags', { user_id: userId })
  const payload = {
    user_id: userId,
    status: status ? 1 : 0,
    risk_reason: reason || '',
    risk_tags: JSON.stringify(tags || []),
    source,
    blocked_at: status ? new Date().toISOString() : null,
    cleared_at: status ? null : new Date().toISOString()
  }

  if (existing) {
    update('user_risk_flags', { user_id: userId }, payload)
    return existing.id
  }

  return insert('user_risk_flags', payload).id
}

const writeAuditLog = (payload) => {
  insert('audit_logs', {
    operator_type: payload.operator_type,
    operator_id: payload.operator_id,
    action: payload.action,
    target_type: payload.target_type,
    target_id: payload.target_id,
    summary: payload.summary || '',
    detail: payload.detail ? JSON.stringify(payload.detail) : ''
  })
}

const getLoginKey = (req, username) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  return `${username}:${ip}`
}

const getLoginState = (key) => {
  const entry = loginAttempts.get(key)
  if (!entry) return { count: 0, lockedUntil: 0 }
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
    loginAttempts.delete(key)
    return { count: 0, lockedUntil: 0 }
  }
  return entry
}

const recordLoginFailure = (key) => {
  const current = getLoginState(key)
  const count = current.count + 1
  const lockedUntil = count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCK_MS : 0
  loginAttempts.set(key, { count, lockedUntil })
  return { count, lockedUntil }
}

const clearLoginAttempts = (key) => {
  loginAttempts.delete(key)
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.json(error('Username and password are required'))
    }

    const loginKey = getLoginKey(req, username)
    const loginState = getLoginState(loginKey)
    if (loginState.lockedUntil && loginState.lockedUntil > Date.now()) {
      return res.json(error('Too many failed attempts, please try again later'))
    }

    const merchant = queryOne('merchants', { username })
    if (!merchant) {
      recordLoginFailure(loginKey)
      return res.json(error('Invalid username or password'))
    }

    const isValid = await bcrypt.compare(password, merchant.password)
    if (!isValid) {
      const { lockedUntil } = recordLoginFailure(loginKey)
      if (lockedUntil) {
        return res.json(error('Too many failed attempts, please try again later'))
      }
      return res.json(error('Invalid username or password'))
    }

    clearLoginAttempts(loginKey)

    const token = jwt.sign(
      { merchantId: merchant.id, username: merchant.username },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '24h' }
    )

    res.json(success({
      token,
      merchant: {
        id: merchant.id,
        username: merchant.username,
        balance: merchant.balance
      }
    }))
  } catch (err) {
    console.error('Login failed:', err)
    res.json(error('Login failed'))
  }
})

router.get('/tasks', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const { page = 1, page_size = 10 } = req.query
    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(page_size, 10) || 10, 1), 50)

    let tasks = query('tasks', { merchant_id: auth.merchant.id }).map(formatTask)
    tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const total = tasks.length
    const offset = (pageNum - 1) * pageSize
    const list = tasks.slice(offset, offset + pageSize)

    res.json(success({ list, total, page: pageNum, page_size: pageSize }))
  } catch (err) {
    console.error('Get tasks failed:', err)
    res.json(error('Get tasks failed'))
  }
})

router.post('/tasks', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const {
      platform,
      title,
      search_keyword,
      shop_name,
      product_name,
      product_link,
      reward_amount,
      total_quota,
      end_time
    } = req.body

    const normalizedPlatform = normalizePlatform(platform)
    const parsedReward = parseFloat(reward_amount)
    const parsedQuota = parseInt(total_quota, 10)

    if (!title || Number.isNaN(parsedReward) || parsedReward <= 0 || Number.isNaN(parsedQuota) || parsedQuota <= 0) {
      return res.json(error('Missing required fields or invalid amount'))
    }

    const task = withTransaction(({ queryOne: txQueryOne, insert: txInsert, update: txUpdate }) => {
      const merchant = txQueryOne('merchants', { id: auth.merchant.id })
      const totalCost = parsedReward * parsedQuota
      if (!merchant || parseFloat(merchant.balance || 0) < totalCost) {
        return { error: 'Insufficient balance' }
      }

      const createdTask = txInsert('tasks', {
        merchant_id: auth.merchant.id,
        platform: normalizedPlatform,
        title,
        search_keyword,
        shop_name,
        product_name: product_name || product_link || '',
        product_link: product_link || '',
        reward_amount: parsedReward,
        total_quota: parsedQuota,
        used_quota: 0,
        end_time,
        status: 1
      })

      txUpdate('merchants', { id: auth.merchant.id }, {
        balance: parseFloat(merchant.balance || 0) - totalCost
      })

      txInsert('audit_logs', {
        operator_type: 'merchant',
        operator_id: auth.merchant.id,
        action: 'task_create',
        target_type: 'task',
        target_id: createdTask.id,
        summary: `Create task: ${title}`,
        detail: JSON.stringify({
          platform: normalizedPlatform,
          reward_amount: parsedReward,
          total_quota: parsedQuota
        })
      })

      return createdTask
    })

    if (task && task.error) {
      return res.json(error(task.error))
    }

    res.json(success({ task_id: task.id }))
  } catch (err) {
    console.error('Create task failed:', err)
    res.json(error('Create task failed'))
  }
})

router.get('/recharges', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const { page = 1, page_size = 20, status } = req.query
    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(page_size, 10) || 20, 1), 50)

    let recharges = query('merchant_recharges', { merchant_id: auth.merchant.id }).map(item => ({
      ...item,
      amount: parseFloat(item.amount || 0),
      payment_method: normalizePaymentMethod(item.payment_method),
      status: normalizeStatus(item.status, 1)
    }))

    if (status !== undefined && status !== null && status !== '') {
      recharges = recharges.filter(item => normalizeStatus(item.status, 1) === parseInt(status, 10))
    }

    recharges.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const total = recharges.length
    const offset = (pageNum - 1) * pageSize

    res.json(success({
      list: recharges.slice(offset, offset + pageSize),
      total,
      page: pageNum,
      page_size: pageSize
    }))
  } catch (err) {
    console.error('Get recharges failed:', err)
    res.json(error('Get recharges failed'))
  }
})

router.post('/recharges', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const amount = parseFloat(req.body.amount)
    const paymentMethod = normalizePaymentMethod(req.body.payment_method ?? req.body.withdraw_type)
    const transactionNo = (req.body.transaction_no || '').trim() || `RC-${Date.now()}-${Math.floor(Math.random() * 100000)}`

    if (Number.isNaN(amount) || amount <= 0) {
      return res.json(error('Invalid recharge amount'))
    }

    const recharge = withTransaction(({ queryOne: txQueryOne, insert: txInsert, update: txUpdate }) => {
      const merchant = txQueryOne('merchants', { id: auth.merchant.id })
      if (!merchant) {
        return { error: 'Merchant not found' }
      }

      const createdRecharge = txInsert('merchant_recharges', {
        merchant_id: auth.merchant.id,
        amount,
        payment_method: paymentMethod,
        transaction_no: transactionNo,
        status: 1
      })

      txUpdate('merchants', { id: auth.merchant.id }, {
        balance: parseFloat(merchant.balance || 0) + amount
      })

      txInsert('audit_logs', {
        operator_type: 'merchant',
        operator_id: auth.merchant.id,
        action: 'merchant_recharge',
        target_type: 'merchant_recharge',
        target_id: createdRecharge.id,
        summary: 'Recharge balance',
        detail: JSON.stringify({
          amount,
          payment_method: paymentMethod,
          transaction_no: transactionNo
        })
      })

      return createdRecharge
    })

    if (recharge && recharge.error) {
      return res.json(error(recharge.error))
    }

    res.json(success({
      recharge_id: recharge.id,
      amount,
      payment_method: paymentMethod,
      transaction_no: transactionNo
    }))
  } catch (err) {
    console.error('Create recharge failed:', err)
    res.json(error('Create recharge failed'))
  }
})

router.patch('/tasks', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const taskId = parseInt(req.body.id ?? req.body.task_id, 10)
    const nextStatus = normalizeTaskStatus(req.body.status ?? req.body.task_status)

    if (!taskId || nextStatus === null) {
      return res.json(error('Missing required parameters'))
    }

    const task = queryOne('tasks', { id: taskId })
    if (!task) {
      return res.json(error('Task not found'))
    }

    if (task.merchant_id !== auth.merchant.id) {
      return res.json(error('No permission'))
    }

    if (normalizeStatus(task.status, 1) === 3 && nextStatus !== 3) {
      return res.json(error('Ended tasks cannot be restored'))
    }

    if (normalizeStatus(task.status, 1) !== nextStatus) {
      withTransaction(({ update: txUpdate, insert: txInsert }) => {
        txUpdate('tasks', { id: taskId }, { status: nextStatus })
        txInsert('audit_logs', {
          operator_type: 'merchant',
          operator_id: auth.merchant.id,
          action: 'task_status_change',
          target_type: 'task',
          target_id: taskId,
          summary: `Task status changed to ${nextStatus}`,
          detail: JSON.stringify({ status: nextStatus })
        })
      })
    }

    res.json(success({ task_id: taskId, status: nextStatus }))
  } catch (err) {
    console.error('Update task status failed:', err)
    res.json(error('Update task status failed'))
  }
})

router.get('/submissions', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const { page = 1, page_size = 10, task_id, status, platform, month_key } = req.query
    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(page_size, 10) || 10, 1), 50)

    const merchantTasks = query('tasks', { merchant_id: auth.merchant.id })
    const taskIds = merchantTasks.map(t => t.id)

    let submissions = query('submissions')
      .filter(s => taskIds.includes(s.task_id))
      .map(formatSubmission)

    if (task_id) {
      submissions = submissions.filter(s => s.task_id === parseInt(task_id, 10))
    }

    if (status !== undefined && status !== null && status !== '') {
      submissions = submissions.filter(s => normalizeStatus(s.review_status) === parseInt(status, 10))
    }

    if (platform) {
      submissions = submissions.filter(s => s.platform === platform)
    }

    if (month_key) {
      submissions = submissions.filter(s => (s.month_key || getMonthKey(s.submit_time)) === month_key)
    }

    submissions.sort((a, b) => new Date(b.submit_time) - new Date(a.submit_time))

    const total = submissions.length
    const offset = (pageNum - 1) * pageSize
    const list = submissions.slice(offset, offset + pageSize)

    res.json(success({ list, total, page: pageNum, page_size: pageSize }))
  } catch (err) {
    console.error('Get submissions failed:', err)
    res.json(error('Get submissions failed'))
  }
})

router.post('/submissions/review', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const submissionId = parseInt(req.body.id ?? req.body.submission_id, 10)
    const reviewStatus = parseInt(req.body.review_status ?? req.body.status, 10)
    const reviewNote = (req.body.review_note ?? req.body.reject_reason ?? '').trim()

    if (!submissionId || ![1, 2].includes(reviewStatus)) {
      return res.json(error('Missing required parameters'))
    }

    const submission = queryOne('submissions', { id: submissionId })
    if (!submission) {
      return res.json(error('Submission not found'))
    }

    const task = queryOne('tasks', { id: submission.task_id })
    if (!task || task.merchant_id !== auth.merchant.id) {
      return res.json(error('No permission'))
    }

    if (normalizeStatus(submission.review_status ?? submission.status ?? 0) !== 0) {
      return res.json(error('Submission already reviewed'))
    }

    const reviewResult = withTransaction(({ queryOne: txQueryOne, update: txUpdate, insert: txInsert }) => {
      const currentSubmission = txQueryOne('submissions', { id: submissionId })
      if (!currentSubmission) {
        return { error: 'Submission not found' }
      }

      const currentTask = txQueryOne('tasks', { id: currentSubmission.task_id })
      if (!currentTask || currentTask.merchant_id !== auth.merchant.id) {
        return { error: 'No permission' }
      }

      if (normalizeStatus(currentSubmission.review_status ?? currentSubmission.status ?? 0) !== 0) {
        return { error: 'Submission already reviewed' }
      }

      const updated = txUpdate('submissions', {
        id: submissionId,
        status: 0
      }, {
        status: reviewStatus,
        review_status: reviewStatus,
        review_note: reviewStatus === 2 ? reviewNote : 'Approved',
        review_time: new Date().toISOString()
      })

      if (!updated) {
        return { error: 'Submission already reviewed' }
      }

      if (reviewStatus === 1) {
        const user = txQueryOne('users', { id: currentSubmission.user_id })
        if (user) {
          const rewardAmount = parseFloat(currentTask.reward_amount || 0)
          const newBalance = parseFloat(user.balance || 0) + rewardAmount
          const newEarnings = parseFloat(user.total_earnings || 0) + rewardAmount

          txUpdate('users', { id: currentSubmission.user_id }, {
            balance: newBalance,
            total_earnings: newEarnings
          })

          txInsert('earnings', {
            user_id: currentSubmission.user_id,
            submission_id: currentSubmission.id,
            type: 1,
            amount: rewardAmount,
            balance_after: newBalance,
            description: `Task reward - ${currentSubmission.task_id}`
          })
        }
      } else {
        txUpdate('tasks', { id: currentSubmission.task_id }, {
          used_quota: Math.max((currentTask.used_quota || 0) - 1, 0)
        })
      }

      txInsert('audit_logs', {
        operator_type: 'merchant',
        operator_id: auth.merchant.id,
        action: 'submission_review',
        target_type: 'submission',
        target_id: submissionId,
        summary: reviewStatus === 1 ? 'Approve submission' : 'Reject submission',
        detail: JSON.stringify({
          review_status: reviewStatus,
          task_id: currentSubmission.task_id,
          user_id: currentSubmission.user_id,
          reward_amount: currentTask.reward_amount
        })
      })

      return { ok: true }
    })

    if (reviewResult && reviewResult.error) {
      return res.json(error(reviewResult.error))
    }

    res.json(success({ message: 'Review completed' }))
  } catch (err) {
    console.error('Review failed:', err)
    res.json(error('Review failed'))
  }
})

router.get('/stats', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const { month_key = getMonthKey(new Date()) } = req.query

    res.json(success({
      month_key,
      list: buildPlatformStats(month_key, auth.merchant.id)
    }))
  } catch (err) {
    console.error('Get stats failed:', err)
    res.json(error('Get stats failed'))
  }
})

router.get('/withdrawals', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const { page = 1, page_size = 20, status } = req.query
    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(page_size, 10) || 20, 1), 50)

    let withdrawals = query('withdrawals').map(item => ({
      ...item,
      amount: parseFloat(item.amount || 0),
      fee: parseFloat(item.fee || 0),
      actual_amount: parseFloat(item.actual_amount || 0),
      account_info: safeDecrypt(item.account_info)
    }))

    if (status !== undefined && status !== null && status !== '') {
      withdrawals = withdrawals.filter(item => normalizeStatus(item.status) === parseInt(status, 10))
    }

    withdrawals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const total = withdrawals.length
    const offset = (pageNum - 1) * pageSize

    res.json(success({
      list: withdrawals.slice(offset, offset + pageSize),
      total,
      page: pageNum,
      page_size: pageSize
    }))
  } catch (err) {
    console.error('Get withdrawals failed:', err)
    res.json(error('Get withdrawals failed'))
  }
})

router.patch('/withdrawals', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const withdrawalId = parseInt(req.body.id ?? req.body.withdrawal_id, 10)
    const nextStatus = normalizeWithdrawStatus(req.body.status)
    const rejectReason = (req.body.reject_reason || '').trim()

    if (!withdrawalId || nextStatus === null) {
      return res.json(error('Missing required parameters'))
    }

    const withdrawal = queryOne('withdrawals', { id: withdrawalId })
    if (!withdrawal) {
      return res.json(error('Withdrawal not found'))
    }
    if (normalizeStatus(withdrawal.status) !== 0) {
      return res.json(error('Withdrawal already processed'))
    }

    const user = queryOne('users', { id: withdrawal.user_id })
    if (!user) {
      return res.json(error('User not found'))
    }

    const amount = parseFloat(withdrawal.amount || 0)
    const frozenBalance = parseFloat(user.frozen_balance || 0)
    const availableBalance = parseFloat(user.available_balance || 0)

    if (frozenBalance < amount) {
      return res.json(error('Frozen balance is insufficient'))
    }

    const result = withTransaction(({ update: txUpdate, insert: txInsert }) => {
      if (nextStatus === 1) {
        txUpdate('withdrawals', { id: withdrawalId }, {
          status: 1,
          processed_at: new Date().toISOString()
        })
        txUpdate('users', { id: withdrawal.user_id }, {
          frozen_balance: frozenBalance - amount
        })
      } else {
        if (!rejectReason) {
          return { error: 'Reject reason is required' }
        }

        txUpdate('withdrawals', { id: withdrawalId }, {
          status: 2,
          reject_reason: rejectReason,
          processed_at: new Date().toISOString()
        })
        txUpdate('users', { id: withdrawal.user_id }, {
          available_balance: availableBalance + amount,
          frozen_balance: frozenBalance - amount
        })
      }

      txInsert('audit_logs', {
        operator_type: 'merchant',
        operator_id: auth.merchant.id,
        action: 'withdrawal_review',
        target_type: 'withdrawal',
        target_id: withdrawalId,
        summary: nextStatus === 1 ? 'Approve withdrawal' : 'Reject withdrawal',
        detail: JSON.stringify({
          status: nextStatus,
          user_id: withdrawal.user_id,
          amount: withdrawal.amount,
          reject_reason: nextStatus === 2 ? rejectReason : ''
        })
      })

      return { ok: true }
    })

    if (result && result.error) {
      return res.json(error(result.error))
    }

    res.json(success({
      withdrawal_id: withdrawalId,
      status: nextStatus
    }))
  } catch (err) {
    console.error('Withdraw review failed:', err)
    res.json(error('Withdraw review failed'))
  }
})

router.get('/audit-logs', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return
    const { page = 1, page_size = 20, action, target_type } = req.query
    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(page_size, 10) || 20, 1), 50)

    let logs = query('audit_logs')
      .filter(item => item.operator_type === 'merchant' && item.operator_id === auth.merchant.id)

    if (action) {
      logs = logs.filter(item => item.action === action)
    }

    if (target_type) {
      logs = logs.filter(item => item.target_type === target_type)
    }

    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    const total = logs.length
    const offset = (pageNum - 1) * pageSize

    res.json(success({
      list: logs.slice(offset, offset + pageSize).map(item => ({
        ...item,
        detail: item.detail ? (() => {
          try {
            return JSON.parse(item.detail)
          } catch {
            return item.detail
          }
        })() : null
      })),
      total,
      page: pageNum,
      page_size: pageSize
    }))
  } catch (err) {
    console.error('Get audit logs failed:', err)
    res.json(error('Get audit logs failed'))
  }
})

router.get('/risk-users', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return

    const { page = 1, page_size = 20, keyword = '', status = '' } = req.query
    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(page_size, 10) || 20, 1), 50)

    let users = query('users')
      .map(user => {
        const risk = queryOne('user_risk_flags', { user_id: user.id })
        return {
          ...user,
          risk_status: risk ? normalizeStatus(risk.status, 0) : 0,
          risk_reason: risk?.risk_reason || '',
          risk_tags: parseTags(risk?.risk_tags),
          blocked_at: risk?.blocked_at || null,
          cleared_at: risk?.cleared_at || null
        }
      })

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      users = users.filter(user => {
        return [user.nickname, user.openid, user.unionid, user.phone]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(kw))
      })
    }

    if (status !== '') {
      users = users.filter(user => normalizeStatus(user.risk_status, 0) === parseInt(status, 10))
    }

    users.sort((a, b) => new Date(b.blocked_at || b.created_at) - new Date(a.blocked_at || a.created_at))

    const total = users.length
    const offset = (pageNum - 1) * pageSize
    const list = await Promise.all(users.slice(offset, offset + pageSize).map(async (user) => {
      const riskSnapshot = getUserRiskSnapshot(user.id)
      return {
        id: user.id,
        openid: user.openid,
        unionid: user.unionid,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        balance: parseFloat(user.balance || 0),
        total_earnings: parseFloat(user.total_earnings || 0),
        available_balance: parseFloat(user.available_balance || 0),
        frozen_balance: parseFloat(user.frozen_balance || 0),
        created_at: user.created_at,
        updated_at: user.updated_at,
        risk_status: user.risk_status,
        risk_reason: user.risk_reason,
        risk_tags: user.risk_tags,
        blocked_at: user.blocked_at,
        cleared_at: user.cleared_at,
        ...riskSnapshot
      }
    }))

    res.json(success({
      total,
      page: pageNum,
      page_size: pageSize,
      list
    }))
  } catch (err) {
    console.error('Get risk users failed:', err)
    res.json(error('Get risk users failed'))
  }
})

router.patch('/risk-users', async (req, res) => {
  try {
    const auth = requireMerchant(req, res)
    if (!auth) return

    const userId = parseInt(req.body.user_id ?? req.body.id, 10)
    if (!userId) {
      return res.json(error('Missing required parameters'))
    }

    const status = req.body.status
    const nextStatus = typeof status === 'boolean'
      ? (status ? 1 : 0)
      : normalizeStatus(status, 1)
    const reason = (req.body.risk_reason || req.body.reason || '后台手动标记').trim()
    const tags = Array.isArray(req.body.risk_tags) ? req.body.risk_tags : parseTags(req.body.risk_tags)

    setRiskFlag(userId, nextStatus === 1, reason, tags, 'merchant')

    res.json(success({
      user_id: userId,
      risk_status: nextStatus,
      risk_reason: reason,
      risk_tags: tags
    }))
  } catch (err) {
    console.error('Update risk user failed:', err)
    res.json(error('Update risk user failed'))
  }
})

module.exports = router
