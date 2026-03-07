// 加密解密工具
const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.CRYPTO_KEY || '12345678901234567890123456789012', 'utf8'); // 32字节
const IV = Buffer.from(process.env.CRYPTO_IV || '1234567890123456', 'utf8'); // 16字节

// 加密
function encrypt(text) {
  if (!text) return null;

  const cipher = crypto.createCipheriv(ALGORITHM, KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// 解密
function decrypt(encrypted) {
  if (!encrypted) return null;

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, IV);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// 手机号脱敏
function maskPhone(phone) {
  if (!phone || phone.length < 11) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

module.exports = {
  encrypt,
  decrypt,
  maskPhone
};
