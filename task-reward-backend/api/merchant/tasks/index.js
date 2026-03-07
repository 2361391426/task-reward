// 商家获取任务列表
const db = require('../../../lib/db');
const { authenticateMerchant } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 认证
  const auth = await authenticateMerchant(req, res);
  if (auth.error) {
    return res.status(auth.status).json(error(auth.error.code, auth.error.message));
  }

  const merchantId = auth.merchant.id;

  // GET - 获取任务列表
  if (req.method === 'GET') {
    try {
      const { page = 1, page_size = 10, status } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(page_size);

      let whereClause = 'WHERE merchant_id = ?';
      const params = [merchantId];

      if (status !== undefined) {
        whereClause += ' AND status = ?';
        params.push(parseInt(status));
      }

      // 获取总数
      const countResult = await db.queryOne(
        `SELECT COUNT(*) as total FROM tasks ${whereClause}`,
        params
      );

      // 获取列表（包含统计）
      const tasks = await db.query(
        `SELECT t.id, t.title, t.reward_amount, t.total_quota, t.remaining_quota,
                t.status, t.created_at,
                COUNT(s.id) as submission_count,
                SUM(CASE WHEN s.status = 0 THEN 1 ELSE 0 END) as pending_review,
                SUM(CASE WHEN s.status = 1 THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN s.status = 2 THEN 1 ELSE 0 END) as rejected
         FROM tasks t
         LEFT JOIN submissions s ON t.id = s.task_id
         ${whereClause}
         GROUP BY t.id
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(page_size), offset]
      );

      res.json(success({
        total: countResult.total,
        page: parseInt(page),
        page_size: parseInt(page_size),
        list: tasks.map(task => ({
          id: task.id,
          title: task.title,
          reward_amount: parseFloat(task.reward_amount),
          total_quota: task.total_quota,
          remaining_quota: task.remaining_quota,
          submission_count: task.submission_count || 0,
          pending_review: task.pending_review || 0,
          approved: task.approved || 0,
          rejected: task.rejected || 0,
          status: task.status,
          created_at: task.created_at
        }))
      }));
    } catch (err) {
      console.error('Get merchant tasks error:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  }
  // POST - 创建任务
  else if (req.method === 'POST') {
    try {
      const {
        title,
        description,
        reward_amount,
        total_quota,
        search_keyword,
        shop_name,
        product_link,
        requirements,
        start_time,
        end_time
      } = req.body;

      // 验证必填字段
      if (!title || !reward_amount || !total_quota) {
        return res.status(400).json(error(1001, '缺少必填字段'));
      }

      // 验证商家余额
      const totalCost = parseFloat(reward_amount) * parseInt(total_quota);
      if (auth.merchant.balance < totalCost) {
        return res.status(400).json(error(3001, '余额不足'));
      }

      // 使用事务
      const result = await db.transaction(async (connection) => {
        // 1. 创建任务
        const [insertResult] = await connection.query(
          `INSERT INTO tasks
           (merchant_id, title, description, reward_amount, total_quota, remaining_quota,
            search_keyword, shop_name, product_link, requirements, start_time, end_time,
            status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [merchantId, title, description, reward_amount, total_quota, total_quota,
           search_keyword, shop_name, product_link, JSON.stringify(requirements),
           start_time, end_time]
        );

        // 2. 扣除商家余额
        await connection.query(
          'UPDATE merchants SET balance = balance - ? WHERE id = ?',
          [totalCost, merchantId]
        );

        return { task_id: insertResult.insertId };
      });

      res.json(success(result, '任务创建成功'));
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  } else {
    res.status(405).json(error(405, 'Method not allowed'));
  }
};
