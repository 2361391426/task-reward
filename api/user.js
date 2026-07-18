import request from '../utils/request.js'

const CACHE_TTL = 30000
const cacheStore = new Map()

const makeKey = (name, params = {}) => `${name}:${JSON.stringify(params)}`

const cloneValue = (value) => {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value))
}

const getCached = (key) => {
  const entry = cacheStore.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cacheStore.delete(key)
    return null
  }
  return cloneValue(entry.value)
}

const setCached = (key, value) => {
  cacheStore.set(key, {
    timestamp: Date.now(),
    value: cloneValue(value)
  })
}

export const invalidateUserCache = () => {
  cacheStore.clear()
}

export const wxLogin = (code, profile = {}) => {
  return request({
    url: '/user/login',
    method: 'POST',
    data: {
      code,
      nickname: profile.nickname || '',
      avatar: profile.avatar || ''
    }
  }).then((res) => {
    invalidateUserCache()
    return res
  })
}

export const bindUserPhone = (code) => {
  return request({
    url: '/user/phone',
    method: 'POST',
    data: { code }
  }).then((res) => {
    invalidateUserCache()
    return res
  })
}

export const getUserInfo = () => {
  const key = makeKey('user-info')
  const cached = getCached(key)
  if (cached) return Promise.resolve(cached)

  return request({
    url: '/user/info',
    method: 'GET'
  }).then((res) => {
    setCached(key, res)
    return res
  })
}

export const updateUserInfo = (data) => {
  return request({
    url: '/user/info',
    method: 'PUT',
    data
  }).then((res) => {
    invalidateUserCache()
    return res
  })
}

export const getEarnings = () => {
  const key = makeKey('earnings')
  const cached = getCached(key)
  if (cached) return Promise.resolve(cached)

  return request({
    url: '/user/earnings',
    method: 'GET'
  }).then((res) => {
    setCached(key, res)
    return res
  })
}

export const getWithdrawals = (params) => {
  const key = makeKey('withdrawals', params)
  const cached = getCached(key)
  if (cached) return Promise.resolve(cached)

  return request({
    url: '/user/withdrawals',
    method: 'GET',
    data: params
  }).then((res) => {
    setCached(key, res)
    return res
  })
}

export const submitWithdrawal = (data) => {
  return request({
    url: '/user/withdrawals',
    method: 'POST',
    data
  }).then((res) => {
    invalidateUserCache()
    return res
  })
}
