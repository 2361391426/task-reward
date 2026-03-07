// 获取我的提交记录
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
    const { page = 1, page_size = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);

    // 构建查询条件
    let whereClause = 'WHERE s.user_id = ?';
    const params = [userId];

    if (status !== undefined) {
      whereClause += ' AND s.status = ?';
      params.push(parseInt(status));
    }

    // 获取总数
    const countResult = await db.queryOne(
      `SELECT COUNT(*) as total FROM submissions s ${whereClause}`,
      params
    );

    // 获取列表
    const submissions = await db.query(
      `SELECT s.id, s.task_id, t.title as task_title, s.reward_amount,
              s.status, s.reject_reason, s.created_at, s.reviewed_at
       FROM submissions s
       LEFT JOIN tasks t ON s.task_id = t.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(page_size), offset]
    );

    res.json(success({
      total: countResult.total,
      page: parseInt(page),
      page_size: parseInt(page_size),
      list: submissions.map(sub => ({
        id: sub.id,
        task_id: sub.task_id,
        task_title: sub.task_title,
        reward_amount: parseFloat(sub.reward_amount),
        status: sub.status,
        reject_reason: sub.reject_reason,
        created_at: sub.created_at,
        reviewed_at: sub.reviewed_at
      }))
    }));
  } catch (err) {
    console.error('Get my submissions error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
