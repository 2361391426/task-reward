const db = require('./db')
const { authenticateUser } = require('./auth')
const { success, error } = require('./response')

const toSqlDate = (date) => {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

const getDateRange = () => {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return {
    todayStart: toSqlDate(todayStart),
    tomorrowStart: toSqlDate(tomorrowStart),
    monthStart: toSqlDate(monthStart),
    nextMonthStart: toSqlDate(nextMonthStart)
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json(error(405, '请求方法不支持'))
  }

  try {
    const auth = await authenticateUser(req)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    const userId = auth.user.id
    const { todayStart, tomorrowStart, monthStart, nextMonthStart } = getDateRange()

    const todayEarnings = await db.queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM earnings
       WHERE user_id = ? AND type = 1 AND created_at >= ? AND created_at < ?`,
      [userId, todayStart, tomorrowStart]
    )

    const monthEarnings = await db.queryOne(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM earnings
       WHERE user_id = ? AND type = 1 AND created_at >= ? AND created_at < ?`,
      [userId, monthStart, nextMonthStart]
    )

    return res.json(success({
      total_earnings: parseFloat(auth.user.total_earnings || 0),
      available_balance: parseFloat(auth.user.available_balance || 0),
      frozen_balance: parseFloat(auth.user.frozen_balance || 0),
      today_earnings: parseFloat(todayEarnings?.total || 0),
      month_earnings: parseFloat(monthEarnings?.total || 0)
    }))
  } catch (err) {
    console.error('获取收益信息失败:', err)
    return res.status(500).json(error(500, '获取收益信息失败'))
  }
}
