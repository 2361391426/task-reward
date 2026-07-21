const db = require('../../lib/db')
const { authenticateUser } = require('../../lib/auth')
const { success, error, ErrorCodes } = require('../../lib/response')
const { decrypt } = require('../../lib/crypto')
const { normalizePagination } = require('../../lib/pagination')

const safeDecrypt = (value) => {
  if (!value) return ''
  try {
    return decrypt(value)
  } catch (err) {
    return value
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const auth = await authenticateUser(req)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    if (req.method === 'GET') {
      const { page, page_size } = req.query
      const { page: currentPage, pageSize, offset } = normalizePagination(
        { page, page_size },
        { defaultPageSize: 20, maxPageSize: 50 }
      )

      const totalResult = await db.queryOne(
        'SELECT COUNT(*) AS total FROM withdrawals WHERE user_id = ?',
        [auth.user.id]
      )

      const rows = await db.query(
        `SELECT id, amount, fee, actual_amount, withdraw_type, account_info, status,
                reject_reason, processed_at, created_at
         FROM withdrawals
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [auth.user.id, pageSize, offset]
      )

      return res.json(success({
        total: Number(totalResult?.total || 0),
        page: currentPage,
        page_size: pageSize,
        list: rows.map(row => ({
          ...row,
          amount: Number(row.amount || 0),
          fee: Number(row.fee || 0),
          actual_amount: Number(row.actual_amount || 0),
          status: Number(row.status || 0),
          withdraw_type: Number(row.withdraw_type || 1),
          account_info: safeDecrypt(row.account_info)
        }))
      }))
    }

    if (req.method === 'POST') {
      return res.status(403).json(error(
        ErrorCodes.FORBIDDEN || 403,
        '小程序内暂不支持用户自行发起结算申请，请以平台活动规则和后台处理结果为准'
      ))
    }

    return res.status(405).json(error(405, '请求方法不支持'))
  } catch (err) {
    console.error('Withdrawal error:', err)
    return res.status(500).json(error(500, '服务器错误'))
  }
}
