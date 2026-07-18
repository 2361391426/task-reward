const db = require('../../../lib/db');
const { authenticateMerchant, merchantRoleAllowed } = require('../../../lib/auth');
const { success, error, ErrorCodes } = require('../../../lib/response');
const { normalizePagination } = require('../../../lib/pagination');
const { decrypt, maskPhone } = require('../../../lib/crypto');

const parsePermission = (value) => {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return null;
};

const safeDecryptPhone = (value) => {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch (error) {
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

  const auth = await authenticateMerchant(req, res);
  if (auth.error) {
    return res.status(auth.status).json(error(auth.error.code, auth.error.message));
  }

  if (!merchantRoleAllowed(auth.merchant, ['owner'])) {
    return res.status(403).json(error(ErrorCodes.NO_PERMISSION, 'Permission denied'));
  }

  if (req.method === 'GET') {
    try {
      const { page, page_size, keyword, publish_permission } = req.query;
      const { page: currentPage, pageSize, offset } = normalizePagination(
        { page, page_size },
        { defaultPageSize: 20, maxPageSize: 100 }
      );

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (keyword) {
        whereClause += ' AND (nickname LIKE ? OR phone LIKE ? OR openid LIKE ?)'
        const likeKeyword = `%${keyword}%`;
        params.push(likeKeyword, likeKeyword, likeKeyword);
      }

      const permission = parsePermission(publish_permission);
      if (permission !== null) {
        whereClause += ' AND publish_permission = ?';
        params.push(permission);
      }

      const totalRow = await db.queryOne(
        `SELECT COUNT(*) AS total FROM users ${whereClause}`,
        params
      );

      const rows = await db.query(
        `SELECT id, openid, nickname, avatar, phone, publish_permission, status, created_at, updated_at
         FROM users
         ${whereClause}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      return res.json(success({
        total: totalRow?.total || 0,
        page: currentPage,
        page_size: pageSize,
        list: rows.map((row) => ({
          ...row,
          phone: row.phone ? maskPhone(safeDecryptPhone(row.phone)) : '',
          publish_permission: parseInt(row.publish_permission || 0, 10) || 0,
          status: parseInt(row.status || 1, 10) || 1
        }))
      }));
    } catch (err) {
      console.error('Get merchant users error:', err);
      return res.status(500).json(error(500, 'Server error'));
    }
  }

  if (req.method === 'PATCH') {
    try {
      const userId = req.body.id ?? req.body.user_id;
      const permission = parsePermission(req.body.publish_permission);

      if (!userId || permission === null) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Missing user id or permission'));
      }

      const result = await db.execute(
        'UPDATE users SET publish_permission = ?, updated_at = NOW() WHERE id = ?',
        [permission, userId]
      );

      if (!result.affectedRows) {
        return res.status(404).json(error(ErrorCodes.USER_NOT_FOUND, 'User not found'));
      }

      return res.json(success({
        user_id: parseInt(userId, 10),
        publish_permission: permission
      }, 'User permission updated'));
    } catch (err) {
      console.error('Update merchant user permission error:', err);
      return res.status(500).json(error(500, 'Server error'));
    }
  }

  return res.status(405).json(error(405, 'Method not allowed'));
};
