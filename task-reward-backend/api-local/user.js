const express = require('express')
const router = express.Router()
const { query, queryOne, insert, update, withTransaction } = require('../lib/db-json')
const jwt = require('jsonwebtoken')
const { encrypt, decrypt } = require('../lib/crypto')

const success = (data) => ({ code: 0, data, message: 'success' })
const error = (message) => ({ code: -1, data: null, message })
const authError = (res, message = 'Not logged in') => res.status(401).json(error(message))

const withdrawalLocks = new Set()
const MAX_LOGIN_ATTEMPTS = 10
const LOGIN_LOCK_MS = 15 * 60 * 1000

const getLoginKey = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

const getLoginState = (key) => {
  const entry = queryOne('login_attempts', { login_key: key })
  if (!entry) return { count: 0, lockedUntil: 0 }
  if (entry.locked_until && new Date(entry.locked_until).getTime() <= Date.now()) {
    update('login_attempts', { login_key: key }, {
      count: 0,
      locked_until: null
    })
    return { count: 0, lockedUntil: 0 }
  }
  return {
    count: Number(entry.count) || 0,
    lockedUntil: entry.locked_until ? new Date(entry.locked_until).getTime() : 0
  }
}

const recordLoginFailure = (key) => {
  const current = getLoginState(key)
  const count = current.count + 1
  const lockedUntil = count >= MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + LOGIN_LOCK_MS).toISOString() : null
  const existing = queryOne('login_attempts', { login_key: key })

  if (existing) {
    update('login_attempts', { login_key: key }, {
      count,
      locked_until: lockedUntil
    })
  } else {
    insert('login_attempts', {
      login_key: key,
      count,
      locked_until: lockedUntil
    })
  }

  return { count, lockedUntil: lockedUntil ? new Date(lockedUntil).getTime() : 0 }
}

const clearLoginAttempts = (key) => {
  const existing = queryOne('login_attempts', { login_key: key })
  if (!existing) return

  update('login_attempts', { login_key: key }, {
    count: 0,
    locked_until: null
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

const getRiskSnapshot = (userId) => {
  const risk = queryOne('user_risk_flags', { user_id: userId })
  const cooldowns = query('user_platform_cooldowns', { user_id: userId })
    .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))

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

const normalizePagination = (page, pageSize, fallbackPageSize = 20) => {
  const currentPage = Math.max(parseInt(page, 10) || 1, 1)
  const currentPageSize = Math.min(Math.max(parseInt(pageSize, 10) || fallbackPageSize, 1), 50)
  return {
    page: currentPage,
    page_size: currentPageSize,
    offset: (currentPage - 1) * currentPageSize
  }
}

const safeDecrypt = (value) => {
  if (!value) return ''
  try {
    return decrypt(value)
  } catch (err) {
    return value
  }
}

const getLoginUserId = (req) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret')
    return decoded.userId
  } catch (err) {
    return null
  }
}

router.post('/login', async (req, res) => {
  try {
    const { code } = req.body
    const loginKey = getLoginKey(req)
    const loginState = getLoginState(loginKey)
    if (loginState.lockedUntil && loginState.lockedUntil > Date.now()) {
      return res.json(error('Too many login attempts, please try again later'))
    }
    const openid = code || `test_openid_${Date.now()}`

    let user = queryOne('users', { openid })
    if (!user) {
      user = insert('users', {
        openid,
        nickname: '测试用户',
        avatar: 'https://via.placeholder.com/100',
        balance: 0,
        total_earnings: 0,
        available_balance: 0,
        frozen_balance: 0
      })
    }

    const risk = getRiskSnapshot(user.id)
    clearLoginAttempts(loginKey)

    const token = jwt.sign(
      { userId: user.id, openid: user.openid },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '7d' }
    )

    res.json(success({
      token,
      user: {
        ...user,
        ...risk
      }
    }))
  } catch (err) {
    console.error('Login failed:', err)
    recordLoginFailure(getLoginKey(req))
    res.json(error('Login failed'))
  }
})

router.get('/info', async (req, res) => {
  try {
    const userId = getLoginUserId(req)
    if (!userId) {
      return authError(res)
    }

    const user = queryOne('users', { id: userId })
    if (!user) {
      return res.json(error('User not found'))
    }

    let phone = null
    if (user.phone) {
      const decryptedPhone = safeDecrypt(user.phone)
      phone = decryptedPhone ? `${decryptedPhone.slice(0, 3)}****${decryptedPhone.slice(-4)}` : null
    }

    const risk = getRiskSnapshot(user.id)

    res.json(success({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      phone,
      total_earnings: parseFloat(user.total_earnings || 0),
      available_balance: parseFloat(user.available_balance || 0),
      frozen_balance: parseFloat(user.frozen_balance || 0),
      ...risk
    }))
  } catch (err) {
    console.error('Get user info failed:', err)
    res.json(error('Get user info failed'))
  }
})

router.get('/earnings', async (req, res) => {
  try {
    const userId = getLoginUserId(req)
    if (!userId) {
      return authError(res)
    }

    const user = queryOne('users', { id: userId })
    if (!user) {
      return res.json(error('User not found'))
    }

    res.json(success({
      balance: user.balance || 0,
      total_earnings: user.total_earnings || 0,
      available_balance: user.available_balance || user.balance || 0,
      frozen_balance: user.frozen_balance || 0
    }))
  } catch (err) {
    console.error('Get earnings failed:', err)
    res.json(error('Get earnings failed'))
  }
})

router.get('/withdrawals', async (req, res) => {
  try {
    const userId = getLoginUserId(req)
    if (!userId) {
      return authError(res)
    }

    const { page = 1, page_size = 20 } = req.query
    const pagination = normalizePagination(page, page_size)
    const all = query('withdrawals', { user_id: userId })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const list = all.slice(pagination.offset, pagination.offset + pagination.page_size)

    res.json(success({
      total: all.length,
      page: pagination.page,
      page_size: pagination.page_size,
      list: list.map(item => ({
        ...item,
        account_info: safeDecrypt(item.account_info)
      }))
    }))
  } catch (err) {
    console.error('Get withdrawals failed:', err)
    res.json(error('Get withdrawals failed'))
  }
})

router.post('/withdrawals', async (req, res) => {
  const lockKey = []
  try {
    const userId = getLoginUserId(req)
    if (!userId) {
      return authError(res)
    }

    const lockName = `withdraw:${userId}:${req.body.amount}:${req.body.withdraw_type}:${req.body.account_info}`
    if (withdrawalLocks.has(lockName)) {
      return res.json(error('Request is already in progress'))
    }
    withdrawalLocks.add(lockName)
    lockKey.push(lockName)

    const amount = parseFloat(req.body.amount)
    const withdrawType = parseInt(req.body.withdraw_type || 1, 10)
    const accountInfo = (req.body.account_info || '').trim()

    if (Number.isNaN(amount) || amount <= 0) {
      return res.json(error('Invalid withdrawal amount'))
    }
    if (![1, 2].includes(withdrawType)) {
      return res.json(error('Invalid withdrawal method'))
    }
    if (!accountInfo) {
      return res.json(error('Account information is required'))
    }

    const minAmount = 10
    const feeRate = 0.01
    if (amount < minAmount) {
      return res.json(error('Withdrawal amount is too low'))
    }

    const user = queryOne('users', { id: userId })
    const available = parseFloat(user?.available_balance || user?.balance || 0)
    const frozen = parseFloat(user?.frozen_balance || 0)
    if (!user || available < amount) {
      return res.json(error('Insufficient available balance'))
    }

    const withdrawalFee = Number((amount * feeRate).toFixed(2))
    const actualAmount = Number((amount - withdrawalFee).toFixed(2))
    if (actualAmount <= 0) {
      return res.json(error('Withdrawal amount is too small after fee'))
    }

    const withdrawal = withTransaction(({ update: txUpdate, insert: txInsert }) => {
      txUpdate('users', { id: userId }, {
        available_balance: available - amount,
        frozen_balance: frozen + amount
      })

      const createdWithdrawal = txInsert('withdrawals', {
        user_id: userId,
        amount,
        fee: withdrawalFee,
        actual_amount: actualAmount,
        withdraw_type: withdrawType,
        account_info: encrypt(accountInfo),
        status: 0
      })

      txInsert('audit_logs', {
        operator_type: 'user',
        operator_id: userId,
        action: 'withdrawal_request',
        target_type: 'withdrawal',
        target_id: createdWithdrawal.id,
        summary: 'Submit withdrawal request',
        detail: JSON.stringify({
          amount,
          fee: withdrawalFee,
          actual_amount: actualAmount,
          withdraw_type: withdrawType
        })
      })

      return createdWithdrawal
    })

    res.json(success({
      withdrawal_id: withdrawal.id,
      amount,
      fee: withdrawalFee,
      actual_amount: actualAmount
    }, 'Withdrawal request submitted'))
  } catch (err) {
    console.error('Withdrawal request failed:', err)
    res.json(error('Withdrawal request failed'))
  } finally {
    lockKey.forEach(key => withdrawalLocks.delete(key))
  }
})

module.exports = router
