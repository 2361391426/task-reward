const db = require('../../../lib/db');
const { authenticateMerchant } = require('../../../lib/auth');
const { success, error, ErrorCodes } = require('../../../lib/response');
const { parsePositiveInt } = require('../../../lib/pagination');

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
    const auth = await authenticateMerchant(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    const merchantId = auth.merchant.id;
    const id = req.query.id ?? req.body.id ?? req.body.submission_id;
    const reviewStatus = parsePositiveInt(req.body.review_status ?? req.body.status, NaN);
    const rejectReason = (req.body.reject_reason ?? req.body.review_note ?? '').trim();

    if (!id || Number.isNaN(reviewStatus)) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少必要参数'));
    }

    if (![1, 2].includes(reviewStatus)) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '状态值无效'));
    }

    if (reviewStatus === 2 && !rejectReason) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '驳回时必须填写原因'));
    }

    await db.transaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT s.*, t.merchant_id
         FROM submissions s
         JOIN tasks t ON s.task_id = t.id
         WHERE s.id = ? FOR UPDATE`,
        [id]
      );

      const submission = rows[0];
      if (!submission) {
        throw new Error('submission_not_found');
      }

      if (submission.merchant_id !== merchantId) {
        throw new Error('permission_denied');
      }

      if (parsePositiveInt(submission.status, 0) !== 0) {
        throw new Error('submission_reviewed');
      }

      const [updateResult] = await connection.query(
        `UPDATE submissions
         SET status = ?, reject_reason = ?, reviewed_at = NOW(), updated_at = NOW()
         WHERE id = ? AND status = 0`,
        [reviewStatus, rejectReason || null, id]
      );

      if (!updateResult.affectedRows) {
        throw new Error('submission_reviewed');
      }

      if (reviewStatus === 1) {
        const rewardAmount = parseFloat(submission.reward_amount || 0);

        const [userRows] = await connection.query(
          `SELECT id, available_balance
           FROM users
           WHERE id = ? FOR UPDATE`,
          [submission.user_id]
        );

        const user = userRows[0];
        if (!user) {
          throw new Error('user_not_found');
        }

        const balanceAfter = parseFloat(user.available_balance || 0) + rewardAmount;

        await connection.query(
          `UPDATE users
           SET total_earnings = total_earnings + ?,
               available_balance = available_balance + ?,
               updated_at = NOW()
           WHERE id = ?`,
          [rewardAmount, rewardAmount, submission.user_id]
        );

        await connection.query(
          `INSERT INTO earnings
           (user_id, submission_id, type, amount, balance_after, description, created_at)
           VALUES (?, ?, 1, ?, ?, ?, NOW())`,
          [submission.user_id, id, rewardAmount, balanceAfter, `任务返现 - ${submission.task_id}`]
        );
      } else {
        await connection.query(
          'UPDATE tasks SET remaining_quota = remaining_quota + 1 WHERE id = ?',
          [submission.task_id]
        );
      }

      try {
        await connection.query(
          `INSERT INTO audit_logs
           (operator_type, operator_id, action, target_type, target_id, summary, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            'merchant',
            merchantId,
            'submission_review',
            'submission',
            id,
            reviewStatus === 1 ? '审核通过提交' : '审核驳回提交',
            JSON.stringify({
              review_status: reviewStatus,
              task_id: submission.task_id,
              user_id: submission.user_id,
              reward_amount: submission.reward_amount
            })
          ]
        );
      } catch (logErr) {
        console.error('Write audit log failed:', logErr);
      }
    });

    return res.json(success(null, '审核成功'));
  } catch (err) {
    console.error('Review submission error:', err);

    if (err.message === 'submission_not_found') {
      return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, '提交记录不存在'));
    }
    if (err.message === 'permission_denied') {
      return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '无权审核该提交'));
    }
    if (err.message === 'submission_reviewed') {
      return res.status(400).json(error(ErrorCodes.REVIEW_FAILED, '该提交已审核'));
    }
    if (err.message === 'user_not_found') {
      return res.status(404).json(error(ErrorCodes.USER_NOT_FOUND, '用户不存在'));
    }

    return res.status(500).json(error(500, '服务器错误'));
  }
};
