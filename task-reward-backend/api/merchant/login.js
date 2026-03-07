// 商家登录
const bcrypt = require('bcrypt');
const db = require('../../lib/db');
const { generateToken } = require('../../lib/auth');
const { success, error, ErrorCodes } = require('../../lib/response');

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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '用户名和密码不能为空'));
    }

    // 查找商家
    const merchant = await db.queryOne(
      'SELECT * FROM merchants WHERE username = ?',
      [username]
    );

    if (!merchant) {
      return res.status(401).json(error(ErrorCodes.USER_NOT_FOUND, '用户名或密码错误'));
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, merchant.password);

    if (!isPasswordValid) {
      return res.status(401).json(error(ErrorCodes.USER_NOT_FOUND, '用户名或密码错误'));
    }

    if (merchant.status !== 1) {
      return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '账号已被禁用'));
    }

    // 生成token
    const token = generateToken({
      user_id: merchant.id,
      type: 'merchant'
    }, '24h');

    res.json(success({
      token,
      merchant: {
        id: merchant.id,
        username: merchant.username,
        company_name: merchant.company_name,
        balance: parseFloat(merchant.balance || 0)
      }
    }));
  } catch (err) {
    console.error('Merchant login error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
