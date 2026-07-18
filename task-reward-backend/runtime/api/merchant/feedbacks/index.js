const db = require('../../../lib/db')
const { authenticateMerchant, merchantRoleAllowed } = require('../../../lib/auth')
const { success, error, ErrorCodes } = require('../../../lib/response')
const { parsePositiveInt } = require('../../../lib/pagination')

const normalizeFeedback = (row) => ({
  id: row.id,
  user_id: row.user_id,
  user_nickname: row.user_nickname || '',
  user_avatar: row.user_avatar || '',
  category: row.category || 'general',
  content: row.content || '',
  contact_info: row.contact_info || '',
  task_id: row.task_id || null,
  task_title: row.task_title || '',
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
    const auth = await authenticateMerchant(req, res)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    if (!merchantRoleAllowed(auth.merchant, ['owner', 'operator', 'reviewer'])) {
      return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '无权限操作'))
    }

    const operatorId = auth.merchant.staff_id || auth.merchant.id

    if (req.method === 'GET') {
      const { status, page = 1, page_size = 20 } = req.query
      const currentStatus = status === undefined || status === '' ? null : parsePositiveInt(status, NaN)
      const pageNum = Math.max(parsePositiveInt(page, 1), 1)
      const pageSize = Math.min(Math.max(parsePositiveInt(page_size, 20), 1), 50)
      const offset = (pageNum - 1) * pageSize

      let whereClause = 'WHERE 1=1'
      const params = []
      if (!Number.isNaN(currentStatus) && currentStatus !== null) {
        whereClause += ' AND f.status = ?'
        params.push(currentStatus)
      }

      const countRow = await db.queryOne(
        `SELECT COUNT(*) AS total
         FROM feedbacks f
         LEFT JOIN tasks t ON t.id = f.task_id
         ${whereClause}`,
        params
      )

      const rows = await db.query(
        `SELECT f.id, f.user_id, f.user_nickname, f.user_avatar, f.category, f.content, f.contact_info,
                f.task_id, f.status, f.reply_content, f.reply_user_type, f.reply_user_id, f.reply_user_name,
                f.replied_at, f.created_at, f.updated_at, t.title AS task_title
         FROM feedbacks f
         LEFT JOIN tasks t ON t.id = f.task_id
         ${whereClause}
         ORDER BY f.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      )

      return res.json(success({
        total: countRow?.total || 0,
        page: pageNum,
        page_size: pageSize,
        list: rows.map(normalizeFeedback)
      }))
    }

    const feedbackId = parsePositiveInt(req.body.id || req.body.feedback_id, 0)
    const replyContent = String(req.body.reply_content || '').trim()
    if (!feedbackId) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少反馈ID'))
    }
    if (!replyContent) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '请填写回复内容'))
    }

    const existing = await db.queryOne(
      'SELECT * FROM feedbacks WHERE id = ?',
      [feedbackId]
    )
    if (!existing) {
      return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, '反馈不存在'))
    }

    await db.execute(
      `UPDATE feedbacks
       SET reply_content = ?,
           reply_user_type = ?,
           reply_user_id = ?,
           reply_user_name = ?,
           status = 1,
           replied_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [
        replyContent,
        auth.merchant.account_type || 'merchant',
        operatorId,
        auth.merchant.nickname || auth.merchant.username || '后台',
        feedbackId
      ]
    )

    return res.json(success({ id: feedbackId, message: '回复已保存' }))
  } catch (err) {
    console.error('Merchant feedback error:', err)
    return res.status(500).json(error(500, '服务器错误'))
  }
}
