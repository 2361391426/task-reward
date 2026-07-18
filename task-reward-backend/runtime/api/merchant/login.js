const bcrypt = require('bcryptjs');
const db = require('../../lib/db');
const { generateToken } = require('../../lib/auth');
const { success, error, ErrorCodes } = require('../../lib/response');

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

const getClientKey = (req, username) => {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  return `${username}:${ip}`;
};

const getAttemptState = (key) => {
  const entry = loginAttempts.get(key);
  if (!entry) {
    return { count: 0, lockedUntil: 0 };
  }
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
    return { count: 0, lockedUntil: 0 };
  }
  return entry;
};

const recordFailedAttempt = (key) => {
  const current = getAttemptState(key);
  const count = current.count + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? Date.now() + LOCK_WINDOW_MS : current.lockedUntil;
  loginAttempts.set(key, { count, lockedUntil });
  return { count, lockedUntil };
};

const clearAttempts = (key) => {
  loginAttempts.delete(key);
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json(error(405, '不支持的请求方法'));
  }

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '请输入用户名和密码'));
    }

    const attemptKey = getClientKey(req, username);
    const attemptState = getAttemptState(attemptKey);
    if (attemptState.lockedUntil && attemptState.lockedUntil > Date.now()) {
      return res.status(429).json(
        error(ErrorCodes.NO_PERMISSION, '失败次数过多，请稍后再试')
      );
    }

    const merchant = await db.queryOne(
      'SELECT * FROM merchants WHERE username = ?',
      [username]
    );

    const staff = merchant
      ? null
      : await db.queryOne(
          `SELECT s.*, m.id AS merchant_id, m.username AS merchant_username, m.company_name, m.balance, m.status AS merchant_status
           FROM merchant_staffs s
           JOIN merchants m ON m.id = s.merchant_id
           WHERE s.username = ?`,
          [username]
        );

    if (!merchant && !staff) {
      const { lockedUntil } = recordFailedAttempt(attemptKey);
      return res.status(401).json(
        error(
          ErrorCodes.USER_NOT_FOUND,
          lockedUntil ? '失败次数过多，请稍后再试' : '用户名或密码错误'
        )
      );
    }

    const authRecord = merchant || staff;
    const isPasswordValid = await bcrypt.compare(password, authRecord.password);
    if (!isPasswordValid) {
      const { lockedUntil } = recordFailedAttempt(attemptKey);
      return res.status(401).json(
        error(
          ErrorCodes.USER_NOT_FOUND,
          lockedUntil ? '失败次数过多，请稍后再试' : '用户名或密码错误'
        )
      );
    }

    if ((merchant && merchant.status !== 1) || (staff && (staff.status !== 1 || staff.merchant_status !== 1))) {
      return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '账号已禁用'));
    }

    clearAttempts(attemptKey);

    const token = generateToken(
      {
        user_id: merchant ? merchant.id : staff.id,
        merchant_id: merchant ? merchant.id : staff.merchant_id,
        type: merchant ? 'merchant' : 'merchant_staff',
        role: merchant ? 'owner' : (staff.role || 'operator')
      },
      '24h'
    );

    return res.json(
      success({
        token,
        merchant: merchant
          ? {
              id: merchant.id,
              merchant_id: merchant.id,
              username: merchant.username,
              company_name: merchant.company_name,
              balance: parseFloat(merchant.balance || 0),
              role: 'owner',
              account_type: 'merchant'
            }
          : {
              id: staff.merchant_id,
              merchant_id: staff.merchant_id,
              staff_id: staff.id,
              username: staff.username,
              nickname: staff.nickname || staff.username,
              company_name: staff.company_name,
              balance: parseFloat(staff.balance || 0),
              role: staff.role || 'operator',
              account_type: 'merchant_staff'
            }
      })
    );
  } catch (err) {
    console.error('Merchant login error:', err);
    return res.status(500).json(error(500, '服务器错误'));
  }
};
