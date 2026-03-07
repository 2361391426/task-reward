// 获取用户收益信息
const db = require('../../lib/db');
const { authenticateUser } = require('../../lib/auth');
const { success, error } = require('../../lib/response');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json(error(405, 'Method not allowed'));
  }

  try {
    const auth = await authenticateUser(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    const userId = auth.user.id;

    // 获取今日收益
    const todayEarnings = await db.queryOne(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM earnings
       WHERE user_id = ? AND type = 1 AND DATE(created_at) = CURDATE()`,
      [userId]
    );

    // 获取本月收益
    const monthEarnings = await db.queryOne(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM earnings
       WHERE user_id = ? AND type = 1
       AND YEAR(created_at) = YEAR(CURDATE())
       AND MONTH(created_at) = MONTH(CURDATE())`,
      [userId]
    );

    res.json(success({
      total_earnings: parseFloat(auth.user.total_earnings || 0),
      available_balance: parseFloat(auth.user.available_balance || 0),
      frozen_balance: parseFloat(auth.user.frozen_balance || 0),
      today_earnings: parseFloat(todayEarnings.total || 0),
      month_earnings: parseFloat(monthEarnings.total || 0)
    }));
  } catch (err) {
    console.error('Get earnings error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
