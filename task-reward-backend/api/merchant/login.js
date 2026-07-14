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
    return res.status(405).json(error(405, 'Method not allowed'));
  }

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json(error(ErrorCodes.PARAM_ERROR, 'Username and password are required'));
    }

    const attemptKey = getClientKey(req, username);
    const attemptState = getAttemptState(attemptKey);
    if (attemptState.lockedUntil && attemptState.lockedUntil > Date.now()) {
      return res.status(429).json(
        error(ErrorCodes.NO_PERMISSION, 'Too many failed attempts, please try again later')
      );
    }

    const merchant = await db.queryOne(
      'SELECT * FROM merchants WHERE username = ?',
      [username]
    );

    if (!merchant) {
      const { lockedUntil } = recordFailedAttempt(attemptKey);
      return res.status(401).json(
        error(
          ErrorCodes.USER_NOT_FOUND,
          lockedUntil ? 'Too many failed attempts, please try again later' : 'Invalid username or password'
        )
      );
    }

    const isPasswordValid = await bcrypt.compare(password, merchant.password);
    if (!isPasswordValid) {
      const { lockedUntil } = recordFailedAttempt(attemptKey);
      return res.status(401).json(
        error(
          ErrorCodes.USER_NOT_FOUND,
          lockedUntil ? 'Too many failed attempts, please try again later' : 'Invalid username or password'
        )
      );
    }

    if (merchant.status !== 1) {
      return res.status(403).json(error(ErrorCodes.NO_PERMISSION, 'Account disabled'));
    }

    clearAttempts(attemptKey);

    const token = generateToken(
      {
        user_id: merchant.id,
        type: 'merchant'
      },
      '24h'
    );

    return res.json(
      success({
        token,
        merchant: {
          id: merchant.id,
          username: merchant.username,
          company_name: merchant.company_name,
          balance: parseFloat(merchant.balance || 0)
        }
      })
    );
  } catch (err) {
    console.error('Merchant login error:', err);
    return res.status(500).json(error(500, 'Server error'));
  }
};
