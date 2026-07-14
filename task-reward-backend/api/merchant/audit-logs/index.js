const db = require('../../../lib/db');
const { authenticateMerchant } = require('../../../lib/auth');
const { success, error } = require('../../../lib/response');
const { normalizePagination } = require('../../../lib/pagination');

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
    const auth = await authenticateMerchant(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    const { page, page_size, action, target_type } = req.query;
    const { page: currentPage, pageSize, offset } = normalizePagination(
      { page, page_size },
      { defaultPageSize: 20, maxPageSize: 50 }
    );

    let whereClause = 'WHERE operator_type = ? AND operator_id = ?';
    const params = ['merchant', auth.merchant.id];

    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }

    if (target_type) {
      whereClause += ' AND target_type = ?';
      params.push(target_type);
    }

    const totalResult = await db.queryOne(
      `SELECT COUNT(*) AS total FROM audit_logs ${whereClause}`,
      params
    );

    const rows = await db.query(
      `SELECT id, operator_type, operator_id, action, target_type, target_id, summary, detail, created_at
       FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json(success({
      total: totalResult?.total || 0,
      page: currentPage,
      page_size: pageSize,
      list: rows.map(row => ({
        ...row,
        detail: row.detail ? (() => {
          try {
            return JSON.parse(row.detail);
          } catch {
            return row.detail;
          }
        })() : null
      }))
    }));
  } catch (err) {
    console.error('Get merchant audit logs error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
