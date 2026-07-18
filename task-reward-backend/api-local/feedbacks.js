const express = require('express')
const router = express.Router()
const { query, queryOne, insert } = require('../lib/db-json')
const jwt = require('jsonwebtoken')

const success = (data) => ({ code: 0, data, message: 'success' })
const error = (message) => ({ code: -1, data: null, message })
const authError = (res, message = '未登录') => res.status(401).json(error(message))

const normalizeCategory = (value) => {
  const categories = ['general', 'bug', 'suggestion', 'complaint']
  return categories.includes(value) ? value : 'general'
}

const normalizeAttachments = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => item && item.url && item.type)
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && item.url && item.type)
      }
    } catch (error) {}
  }

  return []
}

const requireUser = (req, res) => {
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

  const user = queryOne('users', { id: decoded.userId })
  if (!user) {
    authError(res, '用户不存在')
    return null
  }

  return { user }
}

router.get('/', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const rows = query('feedbacks')
    .filter((item) => item.user_id === auth.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  res.json(success({ list: rows }))
})

router.post('/', async (req, res) => {
  const auth = requireUser(req, res)
  if (!auth) return

  const content = String(req.body.content || '').trim()
  if (!content) {
    return res.json(error('请填写反馈内容'))
  }

  const attachments = normalizeAttachments(req.body.attachments)

  const feedback = insert('feedbacks', {
    user_id: auth.user.id,
    user_nickname: auth.user.nickname || '',
    user_avatar: auth.user.avatar || '',
    category: normalizeCategory(req.body.category),
    content,
    contact_info: String(req.body.contact_info || '').trim(),
    attachments,
    task_id: req.body.task_id ? parseInt(req.body.task_id, 10) || null : null,
    status: 0,
    reply_content: '',
    reply_user_type: '',
    reply_user_id: null,
    reply_user_name: '',
    replied_at: null
  })

  res.json(success({ id: feedback.id, message: '反馈已提交' }))
})

module.exports = router
