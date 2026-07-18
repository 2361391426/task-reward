const normalizeToken = (token) => {
  return String(token || '').replace(/^Bearer\s+/i, '').trim()
}

const base64UrlToBase64 = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  if (padding === 2) return `${normalized}==`
  if (padding === 3) return `${normalized}=`
  if (padding === 1) return `${normalized}===`
  return normalized
}

const decodeBase64 = (value) => {
  const padded = base64UrlToBase64(value)
  if (!padded) return ''

  if (typeof atob === 'function') {
    return atob(padded)
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(padded, 'base64').toString('binary')
  }

  return ''
}

const decodeJwtPayload = (token) => {
  const rawToken = normalizeToken(token)
  if (!rawToken) return null

  const parts = rawToken.split('.')
  if (parts.length < 2) return null

  try {
    const binary = decodeBase64(parts[1])
    if (!binary) return null
    const json = decodeURIComponent(
      binary
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    )
    return JSON.parse(json)
  } catch (error) {
    return null
  }
}

export const getSessionType = () => {
  try {
    const payload = decodeJwtPayload(uni.getStorageSync('token'))
    return payload?.type || ''
  } catch (error) {
    return ''
  }
}

export const isMerchantSession = () => {
  return ['merchant', 'merchant_staff'].includes(getSessionType())
}

