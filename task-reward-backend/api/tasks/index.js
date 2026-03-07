// 获取任务列表
const db = require('../../lib/db');
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
    const { page = 1, page_size = 10, status = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);

    // 获取总数
    const countResult = await db.queryOne(
      `SELECT COUNT(*) as total FROM tasks
       WHERE status = ? AND remaining_quota > 0
       AND (start_time IS NULL OR start_time <= NOW())
       AND (end_time IS NULL OR end_time >= NOW())`,
      [status]
    );

    // 获取列表
    const tasks = await db.query(
      `SELECT id, title, description, reward_amount, total_quota, remaining_quota,
              status, created_at
       FROM tasks
       WHERE status = ? AND remaining_quota > 0
       AND (start_time IS NULL OR start_time <= NOW())
       AND (end_time IS NULL OR end_time >= NOW())
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [status, parseInt(page_size), offset]
    );

    res.json(success({
      total: countResult.total,
      page: parseInt(page),
      page_size: parseInt(page_size),
      list: tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        reward_amount: parseFloat(task.reward_amount),
        total_quota: task.total_quota,
        remaining_quota: task.remaining_quota,
        status: task.status,
        created_at: task.created_at
      }))
    }));
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
