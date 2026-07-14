const db = require('../../../lib/db');
const { authenticateMerchant } = require('../../../lib/auth');
const { success, error, ErrorCodes } = require('../../../lib/response');
const { normalizePagination, parsePositiveInt } = require('../../../lib/pagination');
const { decrypt } = require('../../../lib/crypto');

const safeDecrypt = (value) => {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch (err) {
    return value;
  }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json(error(405, 'Method not allowed'));
  }

  try {
    const auth = await authenticateMerchant(req);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    if (req.method === 'GET') {
      const { page, page_size, status } = req.query;
      const { page: currentPage, pageSize, offset } = normalizePagination(
        { page, page_size },
        { defaultPageSize: 20, maxPageSize: 50 }
      );

      let whereClause = 'WHERE 1 = 1';
      const params = [];
      if (status !== undefined && status !== null && status !== '') {
        whereClause += ' AND w.status = ?';
        params.push(parsePositiveInt(status, 0));
      }

      const totalResult = await db.queryOne(
        `SELECT COUNT(*) AS total
         FROM withdrawals w
         ${whereClause}`,
        params
      );

      const rows = await db.query(
        `SELECT w.id, w.user_id, w.amount, w.fee, w.actual_amount, w.withdraw_type,
                w.account_info, w.status, w.reject_reason, w.processed_at, w.created_at,
                u.nickname, u.phone, u.available_balance, u.frozen_balance
         FROM withdrawals w
         LEFT JOIN users u ON u.id = w.user_id
         ${whereClause}
         ORDER BY w.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      return res.json(success({
        total: totalResult?.total || 0,
        page: currentPage,
        page_size: pageSize,
        list: rows.map(row => ({
          ...row,
          amount: parseFloat(row.amount || 0),
          fee: parseFloat(row.fee || 0),
          actual_amount: parseFloat(row.actual_amount || 0),
          status: parsePositiveInt(row.status, 0),
          withdraw_type: parsePositiveInt(row.withdraw_type, 1),
          account_info: safeDecrypt(row.account_info)
        }))
      }));
    }

    const withdrawalId = req.body.id ?? req.body.withdrawal_id;
    const nextStatus = parseInt(req.body.status, 10);
    const rejectReason = (req.body.reject_reason || '').trim();

    if (!withdrawalId || ![1, 2].includes(nextStatus)) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Missing required parameters'));
    }
    if (nextStatus === 2 && !rejectReason) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Reject reason is required'));
    }

    const result = await db.transaction(async (connection) => {
      const [rows] = await connection.query(
        `SELECT w.*, u.available_balance, u.frozen_balance
         FROM withdrawals w
         JOIN users u ON u.id = w.user_id
         WHERE w.id = ? FOR UPDATE`,
        [withdrawalId]
      );

      const withdrawal = rows[0];
      if (!withdrawal) {
        throw new Error('withdrawal_not_found');
      }

      if (parsePositiveInt(withdrawal.status, 0) !== 0) {
        throw new Error('withdrawal_processed');
      }

      if (nextStatus === 1) {
        const [freezeResult] = await connection.query(
          `UPDATE users
           SET frozen_balance = frozen_balance - ?,
               updated_at = NOW()
           WHERE id = ? AND frozen_balance >= ?`,
          [withdrawal.amount, withdrawal.user_id, withdrawal.amount]
        );
        if (!freezeResult.affectedRows) {
          throw new Error('insufficient_frozen_balance');
        }

        await connection.query(
          `UPDATE withdrawals
           SET status = 1, processed_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [withdrawalId]
        );
      } else {
        const [rejectResult] = await connection.query(
          `UPDATE users
           SET available_balance = available_balance + ?,
               frozen_balance = frozen_balance - ?,
               updated_at = NOW()
           WHERE id = ? AND frozen_balance >= ?`,
          [withdrawal.amount, withdrawal.amount, withdrawal.user_id, withdrawal.amount]
        );
        if (!rejectResult.affectedRows) {
          throw new Error('insufficient_frozen_balance');
        }

        await connection.query(
          `UPDATE withdrawals
           SET status = 2, reject_reason = ?, processed_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [rejectReason, withdrawalId]
        );
      }

      await connection.query(
        `INSERT INTO audit_logs
         (operator_type, operator_id, action, target_type, target_id, summary, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          'merchant',
          auth.merchant.id,
          'withdrawal_review',
          'withdrawal',
          withdrawalId,
          nextStatus === 1 ? 'Approve withdrawal' : 'Reject withdrawal',
          JSON.stringify({
            status: nextStatus,
            user_id: withdrawal.user_id,
            amount: withdrawal.amount,
            reject_reason: nextStatus === 2 ? rejectReason : ''
          })
        ]
      );

      return {
        withdrawal_id: parseInt(withdrawalId, 10),
        status: nextStatus
      };
    });

    return res.json(success(result, 'Processed successfully'));
  } catch (err) {
    console.error('Merchant withdrawals error:', err);
    if (err.message === 'withdrawal_not_found') {
      return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, 'Withdrawal record not found'));
    }
    if (err.message === 'withdrawal_processed') {
      return res.status(400).json(error(ErrorCodes.REVIEW_FAILED, 'Withdrawal has already been processed'));
    }
    if (err.message === 'insufficient_frozen_balance') {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Frozen balance is insufficient'));
    }
    return res.status(500).json(error(500, 'Server error'));
  }
};
