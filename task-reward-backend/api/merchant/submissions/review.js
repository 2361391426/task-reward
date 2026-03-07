// 审核任务提交
const db = require('../../../lib/db');
const { authenticateMerchant } = require('../../../lib/auth');
const { success, error, ErrorCodes } = require('../../../lib/response');

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
    const auth = await authenticateMerchant(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    const merchantId = auth.merchant.id;
    const { id } = req.query; // 提交记录ID
    const { status, reject_reason } = req.body;

    if (!id || status === undefined) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少必填参数'));
    }

    if (![1, 2].includes(parseInt(status))) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '状态值无效'));
    }

    if (parseInt(status) === 2 && !reject_reason) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '拒绝时必须填写原因'));
    }

    // 使用事务
    await db.transaction(async (connection) => {
      // 1. 查找提交记录
      const [submissions] = await connection.query(
        `SELECT s.*, t.merchant_id, t.remaining_quota
         FROM submissions s
         JOIN tasks t ON s.task_id = t.id
         WHERE s.id = ? FOR UPDATE`,
        [id]
      );

      const submission = submissions[0];
      if (!submission) {
        throw new Error('提交记录不存在');
      }

      // 2. 验证权限
      if (submission.merchant_id !== merchantId) {
        throw new Error('无权限审核');
      }

      if (submission.status !== 0) {
        throw new Error('该提交已审核');
      }

      // 3. 更新提交状态
      await connection.query(
        `UPDATE submissions
         SET status = ?, reject_reason = ?, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [parseInt(status), reject_reason || null, id]
      );

      // 4. 如果通过，发放奖励
      if (parseInt(status) === 1) {
        const rewardAmount = parseFloat(submission.reward_amount);

        // 更新用户余额
        await connection.query(
          `UPDATE users
           SET total_earnings = total_earnings + ?,
               available_balance = available_balance + ?,
               updated_at = NOW()
           WHERE id = ?`,
          [rewardAmount, rewardAmount, submission.user_id]
        );

        // 获取更新后的余额
        const [users] = await connection.query(
          'SELECT available_balance FROM users WHERE id = ?',
          [submission.user_id]
        );

        // 创建收益记录
        await connection.query(
          `INSERT INTO earnings
           (user_id, submission_id, type, amount, balance_after, description, created_at)
           VALUES (?, ?, 1, ?, ?, ?, NOW())`,
          [submission.user_id, id, rewardAmount, users[0].available_balance,
           `任务奖励：${submission.task_id}`]
        );
      }
      // 5. 如果拒绝，恢复任务名额
      else if (parseInt(status) === 2) {
        await connection.query(
          'UPDATE tasks SET remaining_quota = remaining_quota + 1 WHERE id = ?',
          [submission.task_id]
        );
      }
    });

    res.json(success(null, '审核成功'));
  } catch (err) {
    console.error('Review submission error:', err);

    if (err.message === '提交记录不存在') {
      return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, err.message));
    }
    if (err.message === '无权限审核') {
      return res.status(403).json(error(ErrorCodes.NO_PERMISSION, err.message));
    }
    if (err.message === '该提交已审核') {
      return res.status(400).json(error(ErrorCodes.REVIEW_FAILED, err.message));
    }

    res.status(500).json(error(500, '服务器错误'));
  }
};
