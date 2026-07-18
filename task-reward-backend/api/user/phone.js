const db = require('../../lib/db')
const { authenticateUser } = require('../../lib/auth')
const { success, error } = require('../../lib/response')
const { encrypt, decrypt, maskPhone } = require('../../lib/crypto')
const { getPhoneNumberFromCode } = require('../../lib/wechat-miniapp')

const safeDecrypt = (value) => {
  if (!value) return ''
  try {
    return decrypt(value)
  } catch (err) {
    return value
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json(error(405, 'Method not allowed'))
  }

  try {
    const auth = await authenticateUser(req, res)
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message))
    }

    const code = String(req.body?.code || '').trim()
    if (!code) {
      return res.status(400).json(error(400, '缺少手机号授权码'))
    }

    const phoneInfo = await getPhoneNumberFromCode(code)
    const encryptedPhone = encrypt(phoneInfo.phoneNumber)

    await db.execute(
      'UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?',
      [encryptedPhone, auth.user.id]
    )

    const maskedPhone = maskPhone(safeDecrypt(encryptedPhone))

    res.json(success({
      phone: phoneInfo.phoneNumber,
      masked_phone: maskedPhone,
      phone_raw: phoneInfo.phoneNumber
    }))
  } catch (err) {
    console.error('Bind phone error:', err)
    res.status(500).json(error(500, err.message || '手机号绑定失败'))
  }
}
