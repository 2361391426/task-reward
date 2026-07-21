const crypto = require('crypto')

const DEFAULT_SALT = process.env.FRAUD_HASH_SALT || process.env.JWT_SECRET || 'task-reward-fraud-salt'

const normalizeText = (value) => {
  if (value === undefined || value === null) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

const normalizePhone = (value) => {
  const text = normalizeText(value)
  if (!text) return ''
  return text.replace(/[^\d+]/g, '')
}

const normalizeAddress = (value) => {
  const text = normalizeText(value)
  if (!text) return ''
  return text
    .replace(/[，、；;]/g, ',')
    .replace(/\s*,\s*/g, ',')
    .replace(/,+/g, ',')
    .replace(/(^,|,$)/g, '')
}

const hashValue = (type, value) => {
  const normalized = normalizeText(value)
  if (!normalized) return ''
  return crypto
    .createHash('sha256')
    .update(`${DEFAULT_SALT}:${type}:${normalized.toLowerCase()}`)
    .digest('hex')
}

const maskValue = (value, keepStart = 3, keepEnd = 4) => {
  const text = normalizeText(value)
  if (!text) return ''
  if (text.length <= keepStart + keepEnd) {
    return `${text.slice(0, Math.max(1, keepStart))}***`
  }
  return `${text.slice(0, keepStart)}***${text.slice(-keepEnd)}`
}

const getClientIp = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for']
  if (forwarded) {
    const candidate = String(forwarded).split(',')[0]?.trim()
    if (candidate) return candidate
  }

  const realIp = req?.headers?.['x-real-ip']
  if (realIp) {
    const candidate = String(realIp).trim()
    if (candidate) return candidate
  }

  return req?.socket?.remoteAddress || req?.ip || 'unknown'
}

const getDeviceId = (req) => {
  const headers = req?.headers || {}
  const candidates = [
    headers['x-device-id'],
    headers['x-client-id'],
    headers['x-uni-device-id'],
    req?.body?.device_id,
    req?.body?.deviceId
  ]

  for (const candidate of candidates) {
    const value = normalizeText(candidate)
    if (value) return value
  }

  return ''
}

const buildIdentityCandidates = ({ user = {}, phoneNumber = '', addressText = '', req, submissionId = null } = {}) => {
  const platformAccount = normalizeText(user.openid || user.unionid || user.id)
  const candidates = []

  if (platformAccount) {
    candidates.push({
      type: 'account',
      value: platformAccount,
      hash: hashValue('account', platformAccount),
      label: '账号'
    })
  }

  const openid = normalizeText(user.openid)
  if (openid) {
    candidates.push({
      type: 'openid',
      value: openid,
      hash: hashValue('openid', openid),
      label: 'OpenID'
    })
  }

  const unionid = normalizeText(user.unionid)
  if (unionid) {
    candidates.push({
      type: 'unionid',
      value: unionid,
      hash: hashValue('unionid', unionid),
      label: 'UnionID'
    })
  }

  const normalizedPhone = normalizePhone(phoneNumber || user.phone_number || user.phone)
  if (normalizedPhone) {
    candidates.push({
      type: 'phone',
      value: normalizedPhone,
      hash: hashValue('phone', normalizedPhone),
      label: '手机号'
    })
  }

  const ip = getClientIp(req)
  if (ip && ip !== 'unknown') {
    candidates.push({
      type: 'ip',
      value: ip,
      hash: hashValue('ip', ip),
      label: 'IP'
    })
  }

  const deviceId = getDeviceId(req)
  if (deviceId) {
    candidates.push({
      type: 'device',
      value: deviceId,
      hash: hashValue('device', deviceId),
      label: '设备'
    })
  }

  const address = normalizeAddress(addressText)
  if (address) {
    candidates.push({
      type: 'address',
      value: address,
      hash: hashValue('address', address),
      label: '地址'
    })
  }

  return candidates.map(item => ({
    ...item,
    submissionId
  }))
}

const describeIdentityTypes = (types = []) => {
  const uniqueTypes = [...new Set(types.filter(Boolean))]
  const labels = uniqueTypes.map(type => {
    switch (type) {
      case 'account':
        return '账号'
      case 'openid':
        return 'OpenID'
      case 'unionid':
        return 'UnionID'
      case 'phone':
        return '手机号'
      case 'ip':
        return 'IP'
      case 'device':
        return '设备'
      case 'address':
        return '地址'
      default:
        return type
    }
  })
  return labels.join('、')
}

const buildIdentityConflictReason = (types, platform) => {
  const typeText = describeIdentityTypes(types)
  const platformText = platform ? `平台 ${platform}` : '当前平台'
  return `检测到与其他账号共享${typeText}，判定为统一用户，暂不可参与（${platformText}）`
}

const buildCooldownReason = (platform, cooldownUntil) => {
  const platformText = platform ? `${platform}平台` : '当前平台'
  const untilText = cooldownUntil ? new Date(cooldownUntil).toLocaleString('zh-CN') : '三个月后'
  return `${platformText}三个月内已有参与记录，暂不可再次参与，恢复时间：${untilText}`
}

const buildBlockedReason = (reason, tags = []) => {
  const tagText = tags.length > 0 ? ` [${tags.join(', ')}]` : ''
  return `${reason}${tagText}`
}

module.exports = {
  normalizePhone,
  normalizeAddress,
  hashValue,
  maskValue,
  getClientIp,
  getDeviceId,
  buildIdentityCandidates,
  describeIdentityTypes,
  buildIdentityConflictReason,
  buildCooldownReason,
  buildBlockedReason
}
