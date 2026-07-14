// API request wrapper
const IS_DEV = !!import.meta.env.DEV || import.meta.env.MODE === 'development'
const BASE_URL = import.meta.env.VITE_API_BASE_URL || (IS_DEV ? 'http://localhost:3001/api' : '')
const DEVICE_ID_KEY = 'task-reward:device-id'

let refreshingSessionPromise = null
const inFlightRequests = new Map()
const MAX_AUTH_RETRY = 1

const getDeviceId = () => {
  let deviceId = uni.getStorageSync(DEVICE_ID_KEY)
  if (deviceId) {
    return String(deviceId)
  }

  const randomPart = Math.random().toString(36).slice(2, 10)
  const timestampPart = Date.now().toString(36)
  deviceId = `device_${timestampPart}_${randomPart}`
  uni.setStorageSync(DEVICE_ID_KEY, deviceId)
  return deviceId
}

const getAuthHeader = () => {
  const token = uni.getStorageSync('token') || ''
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

const clearSession = () => {
  uni.removeStorageSync('token')
  uni.removeStorageSync('userInfo')
}

const refreshSession = () => {
  if (refreshingSessionPromise) {
    return refreshingSessionPromise
  }

  refreshingSessionPromise = new Promise((resolve, reject) => {
    uni.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('Login code missing'))
          return
        }

        uni.request({
          url: `${BASE_URL}/user/login`,
          method: 'POST',
          data: { code: loginRes.code },
          header: {
            'Content-Type': 'application/json'
          },
          success: (res) => {
            if (res.statusCode === 200 && res.data?.code === 0) {
              const payload = res.data.data || {}
              if (payload.token) {
                uni.setStorageSync('token', payload.token)
              }
              if (payload.user) {
                uni.setStorageSync('userInfo', payload.user)
              }
              resolve(payload)
              return
            }

            reject(new Error(res.data?.message || 'Login failed'))
          },
          fail: reject
        })
      },
      fail: reject
    })
  }).finally(() => {
    refreshingSessionPromise = null
  })

  return refreshingSessionPromise
}

const shouldRefreshSession = (options, res) => {
  if (options.skipAuthRefresh) {
    return false
  }

  const url = options.url || ''
  if (url.includes('/user/login')) {
    return false
  }

  return res.data?.code === 1002 || res.statusCode === 401
}

const buildRequestKey = (options) => {
  const method = (options.method || 'GET').toUpperCase()
  const url = options.url || ''
  const data = method === 'GET' ? options.data || {} : options.data || {}
  return `${method}:${url}:${JSON.stringify(data)}`
}

const request = (options) => {
  if (!BASE_URL) {
    const error = new Error('VITE_API_BASE_URL is not configured')
    uni.showToast({
      title: '接口地址未配置，请先设置生产环境 API',
      icon: 'none'
    })
    return Promise.reject(error)
  }

  const retryCount = options._retryCount || 0
  const method = (options.method || 'GET').toUpperCase()
  const dedupeEnabled = options.dedupe !== false && method === 'GET'
  const requestKey = dedupeEnabled ? buildRequestKey(options) : ''

  if (dedupeEnabled && inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey)
  }

  const pendingRequest = new Promise((resolve, reject) => {
    const timeout = options.timeout || 15000
    const finalize = () => {
      if (dedupeEnabled) {
        inFlightRequests.delete(requestKey)
      }
    }

    uni.request({
      url: BASE_URL + options.url,
      method,
      data: options.data || {},
      timeout,
      header: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
        'x-device-id': getDeviceId(),
        ...(options.header || {})
      },
      success: (res) => {
        if (res.statusCode === 200) {
          if (res.data.code === 0) {
            resolve(res.data.data)
          } else if (shouldRefreshSession(options, res)) {
            if (retryCount >= MAX_AUTH_RETRY) {
              clearSession()
              uni.showToast({
                title: 'Login expired, please sign in again',
                icon: 'none'
              })
              reject(res.data)
              return
            }

            clearSession()
            refreshSession()
              .then(() => request({ ...options, _retryCount: retryCount + 1 }))
              .then(resolve)
              .catch((error) => {
                clearSession()
                uni.showToast({
                  title: 'Login expired, please sign in again',
                  icon: 'none'
                })
                reject(error)
              })
          } else {
            uni.showToast({
              title: res.data?.message || 'Request failed',
              icon: 'none'
            })
            reject(res.data)
          }
        } else if (res.statusCode === 401) {
          if (retryCount >= MAX_AUTH_RETRY || options.skipAuthRefresh || (options.url || '').includes('/user/login')) {
            clearSession()
            uni.showToast({
              title: 'Login expired, please sign in again',
              icon: 'none'
            })
            reject(res)
            return
          }

          clearSession()
          refreshSession()
            .then(() => request({ ...options, _retryCount: retryCount + 1 }))
            .then(resolve)
            .catch((error) => {
              clearSession()
              uni.showToast({
                title: 'Login expired, please sign in again',
                icon: 'none'
              })
              reject(error)
            })
        } else {
          uni.showToast({
            title: 'Network error',
            icon: 'none'
          })
          reject(res)
        }
      },
      fail: (err) => {
        const isTimeout = String(err.errMsg || '').includes('timeout')
        uni.showToast({
          title: isTimeout ? 'Request timeout' : 'Network connection failed',
          icon: 'none'
        })
        reject(err)
      },
      complete: () => {
        finalize()
      }
    })
  })

  if (dedupeEnabled) {
    inFlightRequests.set(requestKey, pendingRequest)
  }

  return pendingRequest
}

export default request
