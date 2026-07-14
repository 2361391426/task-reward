const jwt = require('jsonwebtoken');
const db = require('./db');

const DEV_JWT_SECRET = 'dev-only-secret-change-before-production';
const isProduction = ['production', 'prod'].includes((process.env.NODE_ENV || '').toLowerCase()) ||
  process.env.VERCEL_ENV === 'production';

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (isProduction) {
    throw new Error('JWT_SECRET must be set in production');
  }

  if (!getJwtSecret.warned) {
    console.warn('[auth] JWT_SECRET is not set. Using a development fallback secret.');
    getJwtSecret.warned = true;
  }

  return DEV_JWT_SECRET;
}

function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
}

async function authenticateUser(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: { code: 1002, message: 'Not logged in' }, status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);

  if (!decoded || decoded.type !== 'user') {
    return { error: { code: 1002, message: 'Token invalid or expired' }, status: 401 };
  }

  const user = await db.queryOne(
    'SELECT * FROM users WHERE id = ? AND status = 1',
    [decoded.user_id]
  );

  if (!user) {
    return { error: { code: 2001, message: 'User not found or disabled' }, status: 401 };
  }

  return { user };
}

async function authenticateMerchant(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: { code: 1002, message: 'Not logged in' }, status: 401 };
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyToken(token);

  if (!decoded || decoded.type !== 'merchant') {
    return { error: { code: 1002, message: 'Token invalid or expired' }, status: 401 };
  }

  const merchant = await db.queryOne(
    'SELECT * FROM merchants WHERE id = ? AND status = 1',
    [decoded.user_id]
  );

  if (!merchant) {
    return { error: { code: 2001, message: 'Merchant not found or disabled' }, status: 401 };
  }

  return { merchant };
}

module.exports = {
  generateToken,
  verifyToken,
  authenticateUser,
  authenticateMerchant
};
