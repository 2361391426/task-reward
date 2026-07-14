const db = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { normalizePagination, parsePositiveInt } = require('../../lib/pagination');

const normalizePlatform = (value) => {
  const platforms = ['douyin', 'xiaohongshu', 'taobao', 'jd'];
  return platforms.includes(value) ? value : 'taobao';
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
    const { page, page_size, status = 1, platform } = req.query;
    const { page: currentPage, pageSize, offset } = normalizePagination(
      { page, page_size },
      { defaultPageSize: 10, maxPageSize: 50 }
    );

    let whereClause = 'WHERE status = ? AND remaining_quota > 0';
    const params = [parsePositiveInt(status, 1)];

    if (platform) {
      whereClause += ' AND platform = ?';
      params.push(normalizePlatform(platform));
    }

    whereClause += ' AND (start_time IS NULL OR start_time <= NOW())';
    whereClause += ' AND (end_time IS NULL OR end_time >= NOW())';

    const countResult = await db.queryOne(
      `SELECT COUNT(*) as total FROM tasks ${whereClause}`,
      params
    );

    const tasks = await db.query(
      `SELECT id, platform, title, description, reward_amount, total_quota, remaining_quota,
              status, created_at
       FROM tasks
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json(success({
      total: countResult?.total || 0,
      page: currentPage,
      page_size: pageSize,
      list: tasks.map(task => ({
        id: task.id,
        platform: normalizePlatform(task.platform),
        title: task.title,
        description: task.description,
        reward_amount: parseFloat(task.reward_amount),
        total_quota: task.total_quota,
        remaining_quota: task.remaining_quota,
        status: parsePositiveInt(task.status, 1),
        created_at: task.created_at
      }))
    }));
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
