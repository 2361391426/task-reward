const db = require('../../lib/db')
const { authenticateUser, authenticateMerchant } = require('../../lib/auth')
const { success, error, ErrorCodes } = require('../../lib/response')
const { encrypt, decrypt } = require('../../lib/crypto')
const { parsePositiveInt } = require('../../lib/pagination')
const { syncExpiredTasks } = require('../../lib/task-lifecycle')

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
  wechat_id: submission.wechat_id || '',
  phone_number: safeDecryptPhone(submission.phone_number),
  order_number: submission.order_number || '',
  screenshot_search: submission.screenshot_search,
  screenshot_shop_1: submission.screenshot_shop_1,
  screenshot_shop_2: submission.screenshot_shop_2,
  screenshot_shop_3: submission.screenshot_shop_3,
  screenshot_follow: submission.screenshot_follow,
  screenshot_share: submission.screenshot_share,
  screenshot_detail: submission.screenshot_detail,
  screenshot_cart: submission.screenshot_cart,
  screenshot_paid_order: submission.screenshot_paid_order,
  address_text: submission.address_text || '',
  accepted_at: submission.accepted_at || null,
  expires_at: submission.expires_at || null,
  released_at: submission.released_at || null,
  release_reason: submission.release_reason || '',
  submit_time: submission.created_at,
  review_time: submission.reviewed_at,
  review_note: submission.reject_reason || '',
  review_status: parsePositiveInt(submission.status, 0),
  status: parsePositiveInt(submission.status, 0),
  reject_reason: submission.reject_reason,
  created_at: submission.created_at,
  reviewed_at: submission.reviewed_at
})

const isSocialPlatform = (platform) => ['douyin', 'xiaohongshu'].includes(platform)

const pickField = (primary, fallback) => {
  if (primary !== undefined && primary !== null && String(primary).trim() !== '') {
    return primary
  }
  return fallback
}

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
    await db.transaction(async (connection) => {
      await syncExpiredTasks(connection)
    })

    const userAuth = await authenticateUser(req, res)
    let viewerType = 'user'
    let userId = null
    let merchantId = null

    if (userAuth.error) {
      if (req.method !== 'GET') {
        return res.status(userAuth.status).json(error(userAuth.error.code, userAuth.error.message))
      }

      const merchantAuth = await authenticateMerchant(req, res)
      if (merchantAuth.error) {
        return res.status(merchantAuth.status).json(error(merchantAuth.error.code, merchantAuth.error.message))
      }

      viewerType = 'merchant'
      merchantId = merchantAuth.merchant.id
    } else {
      userId = userAuth.user.id
    }

    const id = req.query.id ?? req.params?.id

    if (!id) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少必要参数'))
    }

    if (req.method === 'GET') {
      const submission = await db.queryOne(
        `SELECT s.*, t.title AS task_title, t.merchant_id
         FROM submissions s
         LEFT JOIN tasks t ON s.task_id = t.id
         WHERE s.id = ?`,
        [id]
      )

      if (!submission) {
        return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, '提交记录不存在'))
      }

      if (viewerType === 'user' && submission.user_id !== userId) {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '无权查看该记录'))
      }

      if (viewerType === 'merchant' && Number(submission.merchant_id) !== Number(merchantId)) {
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

      const submissionStatus = parsePositiveInt(submission.status, 0)
      const now = new Date()
      const isDraft = submissionStatus === -1

      if (!isDraft && submissionStatus !== 2) {
        throw new Error('status_not_allowed')
      }

      if (isDraft && submission.expires_at && new Date(submission.expires_at).getTime() <= now.getTime()) {
        throw new Error('draft_expired')
      }

      const submissionPlatform = submission.platform || ''
      const socialRequired = isSocialPlatform(submissionPlatform)

      const nextWechatId = pickField(req.body.wechat_id, submission.wechat_id || '')
      const nextPhone = pickField(req.body.phone_number, safeDecryptPhone(submission.phone_number))
      const nextOrderNumber = pickField(req.body.order_number, submission.order_number || '')
      const nextPaidAmount = parseFloat(
        pickField(req.body.paid_amount, submission.paid_amount || 0)
      )
      const nextScreens = {
        screenshot_search: pickField(req.body.screenshot_search, submission.screenshot_search),
        screenshot_shop_1: pickField(req.body.screenshot_shop_1, submission.screenshot_shop_1),
        screenshot_shop_2: pickField(req.body.screenshot_shop_2, submission.screenshot_shop_2),
        screenshot_shop_3: pickField(req.body.screenshot_shop_3, submission.screenshot_shop_3),
        screenshot_follow: pickField(req.body.screenshot_follow, submission.screenshot_follow),
        screenshot_share: pickField(req.body.screenshot_share, submission.screenshot_share),
        screenshot_detail: pickField(req.body.screenshot_detail, submission.screenshot_detail),
        screenshot_cart: pickField(req.body.screenshot_cart, submission.screenshot_cart),
        screenshot_paid_order: pickField(req.body.screenshot_paid_order, submission.screenshot_paid_order)
      }

      const requiredValues = [
        nextWechatId,
        nextPhone,
        nextPaidAmount,
        nextOrderNumber,
        nextScreens.screenshot_search,
        nextScreens.screenshot_shop_1,
        nextScreens.screenshot_shop_2,
        nextScreens.screenshot_shop_3,
        nextScreens.screenshot_detail,
        nextScreens.screenshot_cart,
        nextScreens.screenshot_paid_order
      ]

      if (socialRequired) {
        requiredValues.push(nextScreens.screenshot_follow, nextScreens.screenshot_share)
      }

      if (requiredValues.some((value) => value === undefined || value === null || value === '')) {
        throw new Error('missing_fields')
      }

      if (Number.isNaN(nextPaidAmount) || nextPaidAmount <= 0) {
        throw new Error('invalid_amount')
      }

      const nextAcceptedAt = submission.accepted_at || now.toISOString()
      const nextExpiresAt = submission.expires_at || null

      await connection.query(
        `UPDATE submissions
         SET wechat_id = ?,
             phone_number = ?,
             order_number = ?,
             paid_amount = ?,
             screenshot_search = ?,
             screenshot_shop_1 = ?,
             screenshot_shop_2 = ?,
             screenshot_shop_3 = ?,
             screenshot_follow = ?,
             screenshot_share = ?,
             screenshot_detail = ?,
             screenshot_cart = ?,
             screenshot_paid_order = ?,
             address_text = ?,
             accepted_at = ?,
             expires_at = ?,
             released_at = NULL,
             release_reason = NULL,
             status = 0,
             review_status = 0,
             reject_reason = NULL,
             reviewed_at = NULL,
             submit_time = COALESCE(submit_time, NOW()),
             updated_at = NOW()
         WHERE id = ?`,
        [
          nextWechatId,
          encrypt(nextPhone),
          nextOrderNumber,
          nextPaidAmount,
          nextScreens.screenshot_search,
          nextScreens.screenshot_shop_1,
          nextScreens.screenshot_shop_2,
          nextScreens.screenshot_shop_3,
          socialRequired ? nextScreens.screenshot_follow : null,
          socialRequired ? nextScreens.screenshot_share : null,
          nextScreens.screenshot_detail,
          nextScreens.screenshot_cart,
          nextScreens.screenshot_paid_order,
          nextAcceptedAt,
          nextExpiresAt,
          id
        ]
      )

      if (isDraft) {
        await connection.query(
          'UPDATE tasks SET remaining_quota = GREATEST(remaining_quota - 1, 0) WHERE id = ?',
          [submission.task_id]
        )
      }

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
    if (err.message === 'draft_expired') {
      return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '任务已超时释放，请重新接单'))
    }
    if (err.message === 'missing_fields') {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少必要字段'))
    }
    if (err.message === 'invalid_amount') {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '实付金额不正确'))
    }
    return res.status(500).json(error(500, '服务器错误'))
  }
}
