// 获取用户信息
const db = require('../../lib/db');
const { authenticateUser } = require('../../lib/auth');
const { success, error } = require('../../lib/response');
const { decrypt, maskPhone } = require('../../lib/crypto');

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
    // 认证
    const auth = await authenticateUser(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    const user = auth.user;

    // 解密手机号并脱敏
    let phone = null;
    if (user.phone) {
      const decryptedPhone = decrypt(user.phone);
      phone = maskPhone(decryptedPhone);
    }

    res.json(success({
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      phone,
      total_earnings: parseFloat(user.total_earnings || 0),
      available_balance: parseFloat(user.available_balance || 0),
      frozen_balance: parseFloat(user.frozen_balance || 0)
    }));
  } catch (err) {
    console.error('Get user info error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
