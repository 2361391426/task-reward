const db = require('../../lib/db');
const { authenticateUser } = require('../../lib/auth');
const { success, error } = require('../../lib/response');
const { normalizePagination, parsePositiveInt } = require('../../lib/pagination');

const getMonthKey = (value) => {
  const date = new Date(value || Date.now());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
};

const normalizeSubmission = (sub) => ({
  id: sub.id,
  task_id: sub.task_id,
  task_title: sub.task_title,
  platform: sub.platform || 'taobao',
  paid_amount: parseFloat(sub.paid_amount || 0),
  reward_amount: parseFloat(sub.reward_amount || 0),
  wechat_id: sub.wechat_id || '',
  month_key: getMonthKey(sub.created_at),
  submit_time: sub.created_at,
  review_time: sub.reviewed_at,
  review_note: sub.reject_reason || '',
  order_number: sub.order_number || '',
  review_status: parsePositiveInt(sub.status, 0),
  status: parsePositiveInt(sub.status, 0),
  reject_reason: sub.reject_reason,
  created_at: sub.created_at,
  reviewed_at: sub.reviewed_at
});

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
    const { page, page_size, status, task_ids } = req.query;
    const { page: currentPage, pageSize, offset } = normalizePagination(
      { page, page_size },
      { defaultPageSize: 20, maxPageSize: 50 }
    );

    let whereClause = 'WHERE s.user_id = ?';
    const params = [userId];

    if (status !== undefined) {
      whereClause += ' AND s.status = ?';
      params.push(parsePositiveInt(status, 0));
    } else {
      whereClause += ' AND s.status <> -4';
    }

    const taskIdList = String(task_ids || '')
      .split(',')
      .map(item => parsePositiveInt(item, 0))
      .filter(item => item > 0);
    if (taskIdList.length > 0) {
      whereClause += ` AND s.task_id IN (${taskIdList.map(() => '?').join(',')})`;
      params.push(...taskIdList);
    }

    const countResult = await db.queryOne(
      `SELECT COUNT(*) as total FROM submissions s ${whereClause}`,
      params
    );

    const submissions = await db.query(
      `SELECT s.id, s.task_id, t.title as task_title, t.platform, s.paid_amount, s.reward_amount,
              s.wechat_id, s.order_number, s.status, s.reject_reason, s.created_at, s.reviewed_at, s.accepted_at, s.expires_at,
              s.released_at, s.release_reason
       FROM submissions s
       LEFT JOIN tasks t ON s.task_id = t.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

      res.json(success({
        total: countResult.total,
        page: currentPage,
        page_size: pageSize,
        list: submissions.map(normalizeSubmission)
      }));
  } catch (err) {
    console.error('Get my submissions error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
