const db = require('../../../lib/db');
const { authenticateMerchant } = require('../../../lib/auth');
const { success, error, ErrorCodes } = require('../../../lib/response');
const { normalizePagination, parsePositiveInt } = require('../../../lib/pagination');

const normalizePaymentMethod = (value) => {
  const parsed = parseInt(value, 10);
  return [1, 2, 3].includes(parsed) ? parsed : 1;
};

const ensureTransactionNo = (value) => {
  const raw = (value || '').trim();
  if (raw) return raw;
  return `RC-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const auth = await authenticateMerchant(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    if (req.method === 'GET') {
      const { page, page_size, status } = req.query;
      const { page: currentPage, pageSize, offset } = normalizePagination(
        { page, page_size },
        { defaultPageSize: 20, maxPageSize: 50 }
      );

      let whereClause = 'WHERE merchant_id = ?';
      const params = [auth.merchant.id];

      if (status !== undefined && status !== null && status !== '') {
        whereClause += ' AND status = ?';
        params.push(parsePositiveInt(status, 0));
      }

      const totalResult = await db.queryOne(
        `SELECT COUNT(*) AS total FROM merchant_recharges ${whereClause}`,
        params
      );

      const rows = await db.query(
        `SELECT id, merchant_id, amount, payment_method, transaction_no, status, created_at, updated_at
         FROM merchant_recharges
         ${whereClause}
         ORDER BY created_at DESC
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
          payment_method: normalizePaymentMethod(row.payment_method),
          status: parsePositiveInt(row.status, 1)
        }))
      }));
    }

    if (req.method === 'POST') {
      const amount = parseFloat(req.body.amount);
      const paymentMethod = normalizePaymentMethod(req.body.payment_method ?? req.body.withdraw_type);
      const transactionNo = ensureTransactionNo(req.body.transaction_no);

      if (Number.isNaN(amount) || amount <= 0) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Invalid recharge amount'));
      }

      const result = await db.transaction(async (connection) => {
        const [merchantRows] = await connection.query(
          'SELECT id, balance FROM merchants WHERE id = ? FOR UPDATE',
          [auth.merchant.id]
        );

        const merchant = merchantRows[0];
        if (!merchant) {
          throw new Error('merchant_not_found');
        }

        const [insertResult] = await connection.query(
          `INSERT INTO merchant_recharges
           (merchant_id, amount, payment_method, transaction_no, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
          [auth.merchant.id, amount, paymentMethod, transactionNo]
        );

        await connection.query(
          'UPDATE merchants SET balance = balance + ?, updated_at = NOW() WHERE id = ?',
          [amount, auth.merchant.id]
        );

        await connection.query(
          `INSERT INTO audit_logs
           (operator_type, operator_id, action, target_type, target_id, summary, detail, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            'merchant',
            auth.merchant.id,
            'merchant_recharge',
            'merchant_recharge',
            insertResult.insertId,
            'Recharge balance',
            JSON.stringify({
              amount,
              payment_method: paymentMethod,
              transaction_no: transactionNo
            })
          ]
        );

        return {
          recharge_id: insertResult.insertId,
          amount,
          payment_method: paymentMethod,
          transaction_no: transactionNo
        };
      });

      return res.json(success(result, 'Recharge created'));
    }

    return res.status(405).json(error(405, 'Method not allowed'));
  } catch (err) {
    console.error('Merchant recharges error:', err);
    if (err.message === 'merchant_not_found') {
      return res.status(404).json(error(ErrorCodes.USER_NOT_FOUND, 'Merchant not found'));
    }
    return res.status(500).json(error(500, 'Server error'));
  }
};
