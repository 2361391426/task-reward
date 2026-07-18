const db = require('../../lib/db')
const { authenticateUser } = require('../../lib/auth')
const { success, error, ErrorCodes } = require('../../lib/response')
const { parsePositiveInt } = require('../../lib/pagination')

const normalizeCategory = (value) => {
  const categories = ['general', 'bug', 'suggestion', 'complaint']
  return categories.includes(value) ? value : 'general'
}

const normalizeFeedback = (row) => ({
  id: row.id,
  user_id: row.user_id,
  user_nickname: row.user_nickname || '',
  user_avatar: row.user_avatar || '',
  category: row.category || 'general',
  content: row.content || '',
  contact_info: row.contact_info || '',
  task_id: row.task_id || null,
  status: parsePositiveInt(row.status, 0),
  reply_content: row.reply_content || '',
  reply_user_type: row.reply_user_type || '',
  reply_user_id: row.reply_user_id || null,
  reply_user_name: row.reply_user_name || '',
  replied_at: row.replied_at || null,
  created_at: row.created_at,
  updated_at: row.updated_at
})

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const auth = await authenticateUser(req, res)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    if (req.method === 'GET') {
      const rows = await db.query(
        `SELECT id, user_id, user_nickname, user_avatar, category, content, contact_info, task_id,
                status, reply_content, reply_user_type, reply_user_id, reply_user_name, replied_at,
                created_at, updated_at
         FROM feedbacks
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [auth.user.id]
      )

      return res.json(success({
        list: rows.map(normalizeFeedback)
      }))
    }

    const content = String(req.body.content || '').trim()
    if (!content) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '请填写反馈内容'))
    }

    const inserted = await db.queryOne(
      'SELECT id FROM users WHERE id = ?',
      [auth.user.id]
    )
    if (!inserted) {
      return res.status(404).json(error(ErrorCodes.NO_PERMISSION, '用户不存在'))
    }

    const result = await db.execute(
      `INSERT INTO feedbacks
       (user_id, user_nickname, user_avatar, category, content, contact_info, task_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [
        auth.user.id,
        auth.user.nickname || '',
        auth.user.avatar || '',
        normalizeCategory(req.body.category),
        content,
        String(req.body.contact_info || '').trim(),
        req.body.task_id ? parsePositiveInt(req.body.task_id, 0) || null : null
      ]
    )

    return res.json(success({
      id: result.insertId,
      message: '反馈已提交'
    }))
  } catch (err) {
    console.error('User feedback error:', err)
    return res.status(500).json(error(500, '服务器错误'))
  }
}
