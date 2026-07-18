const bcrypt = require('bcryptjs');
const db = require('../../../lib/db');
const { authenticateMerchant, merchantRoleAllowed } = require('../../../lib/auth');
const { success, error, ErrorCodes } = require('../../../lib/response');

const normalizeRole = (value) => {
  const allowed = ['operator', 'reviewer', 'finance'];
  return allowed.includes(value) ? value : 'operator';
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = await authenticateMerchant(req, res);
  if (auth.error) {
    return res.status(auth.status).json(error(auth.error.code, auth.error.message));
  }

  if (!merchantRoleAllowed(auth.merchant, ['owner'])) {
    return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '仅商家主账号可管理员工'));
  }

  const merchantId = auth.merchant.id;

  if (req.method === 'GET') {
    try {
      const rows = await db.query(
        `SELECT id, merchant_id, username, nickname, role, status, created_at, updated_at
         FROM merchant_staffs
         WHERE merchant_id = ?
         ORDER BY created_at DESC`,
        [merchantId]
      );

      return res.json(success({
        list: rows.map(row => ({
          ...row,
          role: normalizeRole(row.role),
          status: parseInt(row.status, 10) || 1
        }))
      }));
    } catch (err) {
      console.error('Get merchant staff error:', err);
      return res.status(500).json(error(500, '服务器错误'));
    }
  }

  if (req.method === 'POST') {
    try {
      const username = String(req.body.username || '').trim();
      const password = String(req.body.password || '').trim();
      const nickname = String(req.body.nickname || '').trim() || null;
      const role = normalizeRole(req.body.role);

      if (!username || !password) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '请输入用户名和密码'));
      }

      const exists = await db.queryOne(
        'SELECT id FROM merchant_staffs WHERE merchant_id = ? AND username = ?',
        [merchantId, username]
      );
      if (exists) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '用户名已存在'));
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const result = await db.query(
        `INSERT INTO merchant_staffs
         (merchant_id, username, password, nickname, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [merchantId, username, passwordHash, nickname, role]
      );

      return res.json(success({
        staff_id: result.insertId,
        username,
        nickname,
        role
      }, '员工账号已创建'));
    } catch (err) {
      console.error('Create merchant staff error:', err);
      return res.status(500).json(error(500, '服务器错误'));
    }
  }

  if (req.method === 'PATCH') {
    try {
      const staffId = parseInt(req.body.id ?? req.body.staff_id, 10);
      if (!staffId) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少员工ID'));
      }

      const staff = await db.queryOne(
        'SELECT * FROM merchant_staffs WHERE id = ? AND merchant_id = ?',
        [staffId, merchantId]
      );
      if (!staff) {
        return res.status(404).json(error(ErrorCodes.USER_NOT_FOUND, '员工不存在'));
      }

      const updates = [];
      const params = [];

      if (Object.prototype.hasOwnProperty.call(req.body, 'nickname')) {
        updates.push('nickname = ?');
        params.push(String(req.body.nickname || '').trim() || null);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
        updates.push('role = ?');
        params.push(normalizeRole(req.body.role));
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
        const nextStatus = parseInt(req.body.status, 10);
        if (![1, 2].includes(nextStatus)) {
          return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '状态无效'));
        }
        updates.push('status = ?');
        params.push(nextStatus);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'password') && String(req.body.password || '').trim()) {
        updates.push('password = ?');
        params.push(await bcrypt.hash(String(req.body.password).trim(), 10));
      }

      if (!updates.length) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '未提供修改内容'));
      }

      params.push(staffId, merchantId);
      await db.query(
        `UPDATE merchant_staffs
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = ? AND merchant_id = ?`,
        params
      );

      return res.json(success({ staff_id: staffId }, '员工已更新'));
    } catch (err) {
      console.error('Update merchant staff error:', err);
      return res.status(500).json(error(500, '服务器错误'));
    }
  }

  return res.status(405).json(error(405, '不支持的请求方法'));
};
