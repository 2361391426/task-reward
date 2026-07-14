const db = require('../../lib/db')
const { authenticateUser } = require('../../lib/auth')
const { success, error, ErrorCodes } = require('../../lib/response')
const { encrypt, decrypt } = require('../../lib/crypto')
const { parsePositiveInt } = require('../../lib/pagination')

const safeDecryptPhone = (value) => {
  if (!value) return ''
  try {
    return decrypt(value)
  } catch (err) {
    return value
  }
}

const normalizeSubmission = (submission) => ({
  id: submission.id,
  task_id: submission.task_id,
  task_title: submission.task_title || '',
  platform: submission.platform || 'taobao',
  paid_amount: parseFloat(submission.paid_amount || 0),
  reward_amount: parseFloat(submission.reward_amount || 0),
  phone_number: safeDecryptPhone(submission.phone_number),
  screenshot_search: submission.screenshot_search,
  screenshot_shop_1: submission.screenshot_shop_1,
  screenshot_shop_2: submission.screenshot_shop_2,
  screenshot_shop_3: submission.screenshot_shop_3,
  screenshot_follow: submission.screenshot_follow,
  screenshot_share: submission.screenshot_share,
  screenshot_detail: submission.screenshot_detail,
  screenshot_cart: submission.screenshot_cart,
  submit_time: submission.created_at,
  review_time: submission.reviewed_at,
  review_note: submission.reject_reason || '',
  review_status: parsePositiveInt(submission.status, 0),
  status: parsePositiveInt(submission.status, 0),
  reject_reason: submission.reject_reason,
  created_at: submission.created_at,
  reviewed_at: submission.reviewed_at
})

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!['GET', 'PUT'].includes(req.method)) {
    return res.status(405).json(error(405, 'Method not allowed'))
  }

  try {
    const auth = await authenticateUser(req, res)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    const userId = auth.user.id
    const id = req.query.id ?? req.params?.id

    if (!id) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少必要参数'))
    }

    if (req.method === 'GET') {
      const submission = await db.queryOne(
        `SELECT s.*, t.title AS task_title
         FROM submissions s
         LEFT JOIN tasks t ON s.task_id = t.id
         WHERE s.id = ?`,
        [id]
      )

      if (!submission) {
        return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, '提交记录不存在'))
      }

      if (submission.user_id !== userId) {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '无权查看该记录'))
      }

      return res.json(success(normalizeSubmission(submission)))
    }

    const risk = await db.queryOne(
      'SELECT status FROM user_risk_flags WHERE user_id = ?',
      [userId]
    )
    if (risk && parsePositiveInt(risk.status, 0) === 1) {
      return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '当前账号已被标记，禁止重新提交'))
    }

    const result = await db.transaction(async (connection) => {
      const [rows] = await connection.query(
        'SELECT * FROM submissions WHERE id = ? FOR UPDATE',
        [id]
      )

      const submission = rows[0]
      if (!submission) {
        throw new Error('submission_not_found')
      }

      if (submission.user_id !== userId) {
        throw new Error('permission_denied')
      }

      if (parsePositiveInt(submission.status, 0) !== 2) {
        throw new Error('status_not_allowed')
      }

      const {
        phone_number,
        paid_amount,
        screenshot_search,
        screenshot_shop_1,
        screenshot_shop_2,
        screenshot_shop_3,
        screenshot_follow,
        screenshot_share,
        screenshot_detail,
        screenshot_cart
      } = req.body

      const actualPaidAmount = parseFloat(paid_amount || submission.paid_amount || 0)
      if (Number.isNaN(actualPaidAmount) || actualPaidAmount <= 0) {
        throw new Error('invalid_amount')
      }

      await connection.query(
        `UPDATE submissions
         SET phone_number = ?,
             paid_amount = ?,
             screenshot_search = ?,
             screenshot_shop_1 = ?,
             screenshot_shop_2 = ?,
             screenshot_shop_3 = ?,
             screenshot_follow = ?,
             screenshot_share = ?,
             screenshot_detail = ?,
             screenshot_cart = ?,
             status = 0,
             reject_reason = NULL,
             reviewed_at = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [
          encrypt(phone_number),
          actualPaidAmount,
          screenshot_search,
          screenshot_shop_1,
          screenshot_shop_2,
          screenshot_shop_3,
          screenshot_follow,
          screenshot_share,
          screenshot_detail,
          screenshot_cart,
          id
        ]
      )

      return { submission_id: parseInt(id, 10) }
    })

    return res.json(success(result, '重新提交成功'))
  } catch (err) {
    console.error('Submission detail error:', err)
    if (err.message === 'submission_not_found') {
      return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, '提交记录不存在'))
    }
    if (err.message === 'permission_denied') {
      return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '无权操作该记录'))
    }
    if (err.message === 'status_not_allowed') {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '当前状态不允许重新提交'))
    }
    if (err.message === 'invalid_amount') {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '实付金额不正确'))
    }
    return res.status(500).json(error(500, '服务器错误'))
  }
}
