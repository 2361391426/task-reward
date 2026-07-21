const db = require('../../../lib/db');
const { authenticateMerchant } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');

const normalizeMonthKey = (value) => {
  if (value) return value;
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json(error(405, '请求方法不支持'));
  }

  try {
    const auth = await authenticateMerchant(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    const merchantId = auth.merchant.id;
    const monthKey = normalizeMonthKey(req.query.month_key);

    const rows = await db.query(
      `SELECT
         t.platform,
         DATE_FORMAT(s.created_at, '%Y-%m') AS month_key,
         COUNT(*) AS submission_count,
         COALESCE(SUM(CASE WHEN s.review_status = 0 THEN 1 ELSE 0 END), 0) AS pending_count,
         COALESCE(SUM(CASE WHEN s.review_status = 1 THEN 1 ELSE 0 END), 0) AS approved_count,
         COALESCE(SUM(CASE WHEN s.review_status = 2 THEN 1 ELSE 0 END), 0) AS rejected_count,
         COALESCE(SUM(s.paid_amount), 0) AS total_paid_amount,
         COALESCE(SUM(s.reward_amount), 0) AS total_reward_amount
       FROM submissions s
       JOIN tasks t ON s.task_id = t.id
       WHERE t.merchant_id = ? AND DATE_FORMAT(s.created_at, '%Y-%m') = ?
       GROUP BY t.platform, DATE_FORMAT(s.created_at, '%Y-%m')
       ORDER BY t.platform`,
      [merchantId, monthKey]
    );

    const platforms = ['douyin', 'xiaohongshu', 'taobao', 'jd'];
    const list = platforms.map(platform => {
      const row = rows.find(item => item.platform === platform) || {};
      return {
        platform,
        month_key: monthKey,
        submission_count: parseInt(row.submission_count || 0),
        pending_count: parseInt(row.pending_count || 0),
        approved_count: parseInt(row.approved_count || 0),
        rejected_count: parseInt(row.rejected_count || 0),
        total_paid_amount: parseFloat(row.total_paid_amount || 0).toFixed(2),
        total_reward_amount: parseFloat(row.total_reward_amount || 0).toFixed(2)
      };
    });

    res.json(success({
      month_key: monthKey,
      list
    }));
  } catch (err) {
    console.error('Get merchant stats error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
