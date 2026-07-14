const db = require('../../lib/db');
const { authenticateUser } = require('../../lib/auth');
const { success, error, ErrorCodes } = require('../../lib/response');
const { encrypt, decrypt } = require('../../lib/crypto');
const { normalizePagination } = require('../../lib/pagination');

const readConfigNumber = async (key, fallback) => {
  try {
    const row = await db.queryOne(
      'SELECT config_value FROM system_config WHERE config_key = ?',
      [key]
    );
    const value = parseFloat(row?.config_value);
    return Number.isNaN(value) ? fallback : value;
  } catch (err) {
    return fallback;
  }
};

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const auth = await authenticateUser(req);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    if (req.method === 'GET') {
      const { page, page_size } = req.query;
      const { page: currentPage, pageSize, offset } = normalizePagination(
        { page, page_size },
        { defaultPageSize: 20, maxPageSize: 50 }
      );

      const totalResult = await db.queryOne(
        'SELECT COUNT(*) AS total FROM withdrawals WHERE user_id = ?',
        [auth.user.id]
      );

      const rows = await db.query(
        `SELECT id, amount, fee, actual_amount, withdraw_type, account_info, status,
                reject_reason, processed_at, created_at
         FROM withdrawals
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [auth.user.id, pageSize, offset]
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
          status: parseInt(row.status, 10) || 0,
          withdraw_type: parseInt(row.withdraw_type, 10) || 1,
          account_info: safeDecrypt(row.account_info)
        }))
      }));
    }

    if (req.method === 'POST') {
      const amount = parseFloat(req.body.amount);
      const withdrawType = parseInt(req.body.withdraw_type || 1, 10);
      const accountInfo = (req.body.account_info || '').trim();

      if (Number.isNaN(amount) || amount <= 0) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Invalid withdrawal amount'));
      }
      if (![1, 2].includes(withdrawType)) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Invalid withdrawal method'));
      }
      if (!accountInfo) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Account information is required'));
      }

      const minAmount = await readConfigNumber('min_withdrawal_amount', 10);
      const feeRate = await readConfigNumber('withdrawal_fee_rate', 0.01);
      if (amount < minAmount) {
        return res.status(400).json(error(ErrorCodes.WITHDRAWAL_AMOUNT_TOO_LOW, 'Withdrawal amount is too low'));
      }

      const withdrawalFee = Number((amount * feeRate).toFixed(2));
      const actualAmount = Number((amount - withdrawalFee).toFixed(2));
      if (actualAmount <= 0) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Withdrawal amount is too small after fee'));
      }

      const result = await db.transaction(async (connection) => {
        const [userRows] = await connection.query(
          'SELECT id, available_balance, frozen_balance FROM users WHERE id = ? FOR UPDATE',
          [auth.user.id]
        );
        const user = userRows[0];
        if (!user) {
          throw new Error('user_not_found');
        }

        const availableBalance = parseFloat(user.available_balance || 0);
        if (availableBalance < amount) {
          throw new Error('insufficient_balance');
        }

        const [updateResult] = await connection.query(
          `UPDATE users
           SET available_balance = available_balance - ?,
               frozen_balance = frozen_balance + ?,
               updated_at = NOW()
           WHERE id = ? AND available_balance >= ?`,
          [amount, amount, auth.user.id, amount]
        );
        if (!updateResult.affectedRows) {
          throw new Error('insufficient_balance');
        }

        const [insertResult] = await connection.query(
          `INSERT INTO withdrawals
           (user_id, amount, fee, actual_amount, withdraw_type, account_info, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
          [auth.user.id, amount, withdrawalFee, actualAmount, withdrawType, encrypt(accountInfo)]
        );

        await connection.query(
          `INSERT INTO audit_logs
           (operator_type, operator_id, action, target_type, target_id, summary, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            'user',
            auth.user.id,
            'withdrawal_request',
            'withdrawal',
            insertResult.insertId,
            'Submit withdrawal request',
            JSON.stringify({
              amount,
              fee: withdrawalFee,
              actual_amount: actualAmount,
              withdraw_type: withdrawType
            })
          ]
        );

        return {
          withdrawal_id: insertResult.insertId,
          amount,
          fee: withdrawalFee,
          actual_amount: actualAmount
        };
      });

      return res.json(success(result, 'Withdrawal request submitted'));
    }

    return res.status(405).json(error(405, 'Method not allowed'));
  } catch (err) {
    console.error('Withdrawal error:', err);
    if (err.message === 'user_not_found') {
      return res.status(404).json(error(ErrorCodes.USER_NOT_FOUND, 'User not found'));
    }
    if (err.message === 'insufficient_balance') {
      return res.status(400).json(error(ErrorCodes.INSUFFICIENT_BALANCE, 'Insufficient available balance'));
    }
    return res.status(500).json(error(500, 'Server error'));
  }
};
