const db = require('../../lib/db');
const { authenticateMerchant, merchantRoleAllowed } = require('../../lib/auth');
const { success, error } = require('../../lib/response');
const { syncExpiredTasks } = require('../../lib/task-lifecycle');

const readConfigNumber = async (key, fallback) => {
  const row = await db.queryOne(
    'SELECT config_value FROM system_config WHERE config_key = ?',
    [key]
  );
  const value = parseFloat(row?.config_value);
  return Number.isNaN(value) ? fallback : value;
};

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
    const auth = await authenticateMerchant(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    if (!merchantRoleAllowed(auth.merchant, ['owner', 'operator', 'reviewer', 'finance'])) {
      return res.status(403).json(error(403, 'Permission denied'));
    }

    const merchantId = auth.merchant.id;
    const reviewTimeoutHours = await readConfigNumber('task_review_timeout', 24);
    const reviewCutoff = new Date(Date.now() - reviewTimeoutHours * 60 * 60 * 1000);

    await db.transaction(async (connection) => {
      await syncExpiredTasks(connection);
    });

    const taskRow = await db.queryOne(
      `SELECT
         SUM(CASE WHEN start_time IS NOT NULL AND start_time > NOW() AND status IN (1, 2) THEN 1 ELSE 0 END) AS pending_publish,
         SUM(CASE WHEN start_time IS NULL OR start_time <= NOW() THEN 1 ELSE 0 END) AS active_or_ready,
         SUM(CASE WHEN end_time IS NOT NULL AND end_time < NOW() THEN 1 ELSE 0 END) AS ended
       FROM tasks
       WHERE merchant_id = ?`,
      [merchantId]
    );

    const pendingReviewRow = await db.queryOne(
      `SELECT COUNT(*) AS total
         FROM submissions s
       JOIN tasks t ON t.id = s.task_id
       WHERE t.merchant_id = ?
         AND s.review_status = 0
         AND s.created_at <= ?`,
      [merchantId, reviewCutoff]
    );

    const pendingWithdrawalsRow = await db.queryOne(
      `SELECT COUNT(*) AS total
       FROM withdrawals w
       JOIN users u ON u.id = w.user_id
       WHERE w.status = 0`,
      []
    );

    const overdueReviews = await db.query(
      `SELECT s.id, s.task_id, s.user_id, s.created_at, s.review_status AS status, t.title AS task_title, u.nickname AS user_nickname
       FROM submissions s
       JOIN tasks t ON t.id = s.task_id
       JOIN users u ON u.id = s.user_id
       WHERE t.merchant_id = ?
         AND s.review_status = 0
         AND s.created_at <= ?
       ORDER BY s.created_at ASC
       LIMIT 10`,
      [merchantId, reviewCutoff]
    );

    return res.json(success({
      review_timeout_hours: reviewTimeoutHours,
      tasks: {
        pending_publish: parseInt(taskRow?.pending_publish || 0, 10),
        active_or_ready: parseInt(taskRow?.active_or_ready || 0, 10),
        ended: parseInt(taskRow?.ended || 0, 10)
      },
      submissions: {
        overdue_review: parseInt(pendingReviewRow?.total || 0, 10)
      },
      withdrawals: {
        pending: parseInt(pendingWithdrawalsRow?.total || 0, 10)
      },
      overdue_reviews: overdueReviews
    }));
  } catch (err) {
    console.error('Get merchant todos error:', err);
    return res.status(500).json(error(500, 'Server error'));
  }
};
