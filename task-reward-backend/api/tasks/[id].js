const db = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { parsePositiveInt } = require('../../lib/pagination');

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
    const { id } = req.query;
    const task = await db.queryOne(
      `SELECT id, platform, title, description, reward_amount, total_quota, remaining_quota,
              status, search_keyword, shop_name, product_link, requirements,
              start_time, end_time, created_at
       FROM tasks
       WHERE id = ?`,
      [id]
    );

    if (!task) {
      return res.status(404).json(error(404, '任务不存在'));
    }

    res.json(success({
      ...task,
      platform: normalizePlatform(task.platform),
      reward_amount: parseFloat(task.reward_amount),
      status: parsePositiveInt(task.status, 1)
    }));
  } catch (err) {
    console.error('Get task detail error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
