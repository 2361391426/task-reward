const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const DEFAULT_KEY = '12345678901234567890123456789012';
const DEFAULT_IV = '1234567890123456';
const KEY_SOURCE = process.env.CRYPTO_KEY || (isProduction ? '' : DEFAULT_KEY);
const LEGACY_IV_SOURCE = process.env.CRYPTO_IV || (isProduction ? '' : DEFAULT_IV);
const LEGACY_ALGORITHM = 'aes-256-cbc';
const GCM_ALGORITHM = 'aes-256-gcm';
const GCM_IV_LENGTH = 12;

if (isProduction && (!process.env.CRYPTO_KEY || !process.env.CRYPTO_IV)) {
  throw new Error('CRYPTO_KEY and CRYPTO_IV are required in production');
}

const KEY = Buffer.from(KEY_SOURCE, 'utf8');
const LEGACY_IV = Buffer.from(LEGACY_IV_SOURCE, 'utf8');

const ensureKey = () => {
  if (KEY.length !== 32) {
    throw new Error('CRYPTO_KEY must be exactly 32 bytes long');
  }
  return KEY;
};

const ensureLegacyIv = () => {
  if (LEGACY_IV.length !== 16) {
    throw new Error('CRYPTO_IV must be exactly 16 bytes long');
  }
  return LEGACY_IV;
};

function encrypt(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv(GCM_ALGORITHM, ensureKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(encrypted) {
  if (!encrypted) return null;

  const value = String(encrypted);
  if (value.startsWith('gcm:')) {
    const parts = value.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted payload');
    }

    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const data = Buffer.from(parts[3], 'hex');
    const decipher = crypto.createDecipheriv(GCM_ALGORITHM, ensureKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  const decipher = crypto.createDecipheriv(LEGACY_ALGORITHM, ensureKey(), ensureLegacyIv());
  let decrypted = decipher.update(value, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function maskPhone(phone) {
  if (!phone || phone.length < 11) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

module.exports = {
  encrypt,
  decrypt,
  maskPhone
};
