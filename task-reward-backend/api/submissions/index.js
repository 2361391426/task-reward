// 提交任务
const db = require('../../lib/db');
const { authenticateUser } = require('../../lib/auth');
const { success, error, ErrorCodes } = require('../../lib/response');
const { encrypt } = require('../../lib/crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json(error(405, 'Method not allowed'));
  }

  try {
    // 认证
    const auth = await authenticateUser(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    const userId = auth.user.id;
    const {
      task_id,
      phone_number,
      screenshot_search,
      screenshot_shop_1,
      screenshot_shop_2,
      screenshot_shop_3,
      screenshot_follow,
      screenshot_share,
      screenshot_detail,
      screenshot_cart
    } = req.body;

    // 验证必填字段
    if (!task_id || !phone_number || !screenshot_search || !screenshot_shop_1 ||
        !screenshot_shop_2 || !screenshot_shop_3 || !screenshot_follow ||
        !screenshot_share || !screenshot_detail || !screenshot_cart) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少必填字段'));
    }

    // 使用事务
    const result = await db.transaction(async (connection) => {
      // 1. 检查任务
      const [tasks] = await connection.query(
        'SELECT * FROM tasks WHERE id = ? FOR UPDATE',
        [task_id]
      );

      const task = tasks[0];
      if (!task) {
        throw new Error('任务不存在');
      }

      if (task.status !== 1) {
        throw new Error('任务已结束');
      }

      if (task.remaining_quota <= 0) {
        throw new Error('名额已满');
      }

      // 检查时间
      const now = new Date();
      if (task.start_time && new Date(task.start_time) > now) {
        throw new Error('任务未开始');
      }
      if (task.end_time && new Date(task.end_time) < now) {
        throw new Error('任务已过期');
      }

      // 2. 检查是否已提交
      const [existing] = await connection.query(
        'SELECT id FROM submissions WHERE task_id = ? AND user_id = ?',
        [task_id, userId]
      );

      if (existing.length > 0) {
        throw new Error('已提交过该任务');
      }

      // 3. 加密手机号
      const encryptedPhone = encrypt(phone_number);

      // 4. 创建提交记录
      const [insertResult] = await connection.query(
        `INSERT INTO submissions
         (task_id, user_id, phone_number, screenshot_search, screenshot_shop_1,
          screenshot_shop_2, screenshot_shop_3, screenshot_follow, screenshot_share,
          screenshot_detail, screenshot_cart, reward_amount, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
        [task_id, userId, encryptedPhone, screenshot_search, screenshot_shop_1,
         screenshot_shop_2, screenshot_shop_3, screenshot_follow, screenshot_share,
         screenshot_detail, screenshot_cart, task.reward_amount]
      );

      // 5. 减少剩余名额
      await connection.query(
        'UPDATE tasks SET remaining_quota = remaining_quota - 1 WHERE id = ?',
        [task_id]
      );

      return { submission_id: insertResult.insertId };
    });

    res.json(success(result, '提交成功，等待审核'));
  } catch (err) {
    console.error('Submit task error:', err);

    if (err.message === '任务不存在') {
      return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, err.message));
    }
    if (err.message === '任务已结束' || err.message === '任务未开始' || err.message === '任务已过期') {
      return res.status(400).json(error(ErrorCodes.TASK_ENDED, err.message));
    }
    if (err.message === '名额已满') {
      return res.status(400).json(error(ErrorCodes.QUOTA_FULL, err.message));
    }
    if (err.message === '已提交过该任务') {
      return res.status(400).json(error(ErrorCodes.ALREADY_SUBMITTED, err.message));
    }

    res.status(500).json(error(500, '服务器错误'));
  }
};
