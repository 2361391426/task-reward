// 用户登录
const axios = require('axios');
const db = require('../../lib/db');
const { generateToken } = require('../../lib/auth');
const { success, error, ErrorCodes } = require('../../lib/response');

module.exports = async (req, res) => {
  // 设置CORS
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
    const { code } = req.body;

    if (!code) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少code参数'));
    }

    // 1. 通过code换取openid
    const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WECHAT_APPID,
        secret: process.env.WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    if (data.errcode) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, data.errmsg));
    }

    const { openid, unionid } = data;

    // 2. 查找或创建用户
    let user = await db.queryOne(
      'SELECT * FROM users WHERE openid = ?',
      [openid]
    );

    if (!user) {
      const result = await db.execute(
        'INSERT INTO users (openid, unionid, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
        [openid, unionid || null]
      );
      user = {
        id: result.insertId,
        openid,
        unionid,
        nickname: null,
        avatar: null,
        total_earnings: 0,
        available_balance: 0
      };
    }

    // 3. 生成JWT token
    const token = generateToken({
      user_id: user.id,
      type: 'user'
    }, '7d');

    res.json(success({
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        total_earnings: parseFloat(user.total_earnings || 0),
        available_balance: parseFloat(user.available_balance || 0)
      }
    }));
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
