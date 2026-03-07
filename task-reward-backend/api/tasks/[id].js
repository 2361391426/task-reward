// 获取任务详情
const db = require('../../lib/db');
const { success, error, ErrorCodes } = require('../../lib/response');

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

    if (!id) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少任务ID'));
    }

    const task = await db.queryOne(
      `SELECT * FROM tasks WHERE id = ?`,
      [id]
    );

    if (!task) {
      return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, '任务不存在'));
    }

    // 解析requirements JSON
    let requirements = null;
    if (task.requirements) {
      try {
        requirements = typeof task.requirements === 'string'
          ? JSON.parse(task.requirements)
          : task.requirements;
      } catch (e) {
        requirements = null;
      }
    }

    res.json(success({
      id: task.id,
      title: task.title,
      description: task.description,
      reward_amount: parseFloat(task.reward_amount),
      total_quota: task.total_quota,
      remaining_quota: task.remaining_quota,
      search_keyword: task.search_keyword,
      shop_name: task.shop_name,
      product_link: task.product_link,
      requirements,
      status: task.status,
      start_time: task.start_time,
      end_time: task.end_time
    }));
  } catch (err) {
    console.error('Get task detail error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
