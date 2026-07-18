const express = require('express')
const router = express.Router()
const { query, queryOne, update } = require('../lib/db-json')
const jwt = require('jsonwebtoken')

const success = (data) => ({ code: 0, data, message: 'success' })
const error = (message) => ({ code: -1, data: null, message })
const authError = (res, message = '未登录') => res.status(401).json(error(message))

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
    authError(res, '登录已过期或无效')
    return null
  }

  const merchant = queryOne('merchants', { id: decoded.merchantId })
  if (!merchant) {
    authError(res, '商家不存在或已禁用')
    return null
  }

  return { merchant, decoded }
}

const parseAttachments = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      return []
    }
  }
  return []
}

router.get('/', async (req, res) => {
  const auth = requireMerchant(req, res)
  if (!auth) return

  const rows = query('feedbacks')
    .map((item) => ({
      ...item,
      attachments: parseAttachments(item.attachments),
      task_title: item.task_id ? (queryOne('tasks', { id: item.task_id }) || {}).title || '' : ''
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  res.json(success({
    list: rows
  }))
})

router.post('/', async (req, res) => {
  const auth = requireMerchant(req, res)
  if (!auth) return

  const feedbackId = parseInt(req.body.id || req.body.feedback_id, 10)
  const replyContent = String(req.body.reply_content || '').trim()
  if (!feedbackId) {
    return res.json(error('缺少反馈ID'))
  }
  if (!replyContent) {
    return res.json(error('请填写回复内容'))
  }

  const existing = queryOne('feedbacks', { id: feedbackId })
  if (!existing) {
    return res.json(error('反馈不存在'))
  }

  update('feedbacks', { id: feedbackId }, {
    reply_content: replyContent,
    reply_user_type: 'merchant',
    reply_user_id: auth.merchant.staff_id || auth.merchant.id,
    reply_user_name: auth.merchant.nickname || auth.merchant.username || '后台',
    status: 1,
    replied_at: new Date().toISOString()
  })

  res.json(success({ id: feedbackId, message: '回复已保存' }))
})

module.exports = router
