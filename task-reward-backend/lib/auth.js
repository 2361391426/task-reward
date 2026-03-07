// JWT认证工具
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 生成token
function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// 验证token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// 用户认证中间件
async function authenticateUser(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: { code: 1002, message: '未登录' }, status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);

  if (!decoded || decoded.type !== 'user') {
    return { error: { code: 1002, message: 'Token无效或已过期' }, status: 401 };
  }

  const user = await db.queryOne(
    'SELECT * FROM users WHERE id = ? AND status = 1',
    [decoded.user_id]
  );

  if (!user) {
    return { error: { code: 2001, message: '用户不存在或已被禁用' }, status: 401 };
  }

  return { user };
}

// 商家认证中间件
async function authenticateMerchant(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: { code: 1002, message: '未登录' }, status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);

  if (!decoded || decoded.type !== 'merchant') {
    return { error: { code: 1002, message: 'Token无效或已过期' }, status: 401 };
  }

  const merchant = await db.queryOne(
    'SELECT * FROM merchants WHERE id = ? AND status = 1',
    [decoded.user_id]
  );

  if (!merchant) {
    return { error: { code: 2001, message: '商家不存在或已被禁用' }, status: 401 };
  }

  return { merchant };
}

module.exports = {
  generateToken,
  verifyToken,
  authenticateUser,
  authenticateMerchant
};
