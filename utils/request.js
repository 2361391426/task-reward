const IS_DEV = !!import.meta.env.DEV || import.meta.env.MODE === 'development' || import.meta.env.VITE_LOCAL_DEBUG_LOGIN === 'true'
const IS_WEIXIN_MP = typeof wx !== 'undefined' && typeof wx.request === 'function'
const DEFAULT_DEV_BASE_URLS = [
  'http://192.168.3.22:3001/api',
  'http://localhost:3001/api',
  'http://127.0.0.1:3001/api'
]

const normalizeBaseUrl = (value) => String(value || '').replace(/\/+$/, '')

const buildBaseUrlList = () => {
  const urls = []
  const envBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)

  if (envBaseUrl) {
    urls.push(envBaseUrl)
  }

  urls.push(...DEFAULT_DEV_BASE_URLS.map(normalizeBaseUrl))
  if (!IS_WEIXIN_MP) {
    urls.push('/api')
  }

  return [...new Set(urls.filter(Boolean))]
}

const BASE_URLS = buildBaseUrlList()
const DEVICE_ID_KEY = 'task-reward:device-id'
const inFlightRequests = new Map()

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
  if (!token) {
    return ''
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

const clearSession = () => {
  uni.removeStorageSync('token')
  uni.removeStorageSync('userInfo')
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

const handleAuthFailure = (message = '请先登录') => {
  if (!IS_DEV) {
    clearSession()
  }
  uni.showToast({
    title: message,
    icon: 'none'
  })
}

const shouldSilenceNetworkFailure = (options) => {
  return IS_DEV && String(options?.url || '').includes('/user/login')
}

const buildRequestKey = (options) => {
  const method = (options.method || 'GET').toUpperCase()
  const url = options.url || ''
  const data = options.data || {}
  return `${method}:${url}:${JSON.stringify(data)}`
}

const request = (options) => {
  const method = (options.method || 'GET').toUpperCase()
  const dedupeEnabled = options.dedupe !== false && method === 'GET'
  const requestKey = dedupeEnabled ? buildRequestKey(options) : ''

  if (dedupeEnabled && inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey)
  }

  const pendingRequest = new Promise((resolve, reject) => {
    const timeout = options.timeout || 15000

    const tryRequest = (index, lastError = null) => {
      if (index >= BASE_URLS.length) {
        const isTimeout = String(lastError?.errMsg || '').includes('timeout')
        if (!shouldSilenceNetworkFailure(options)) {
          uni.showToast({
            title: isTimeout ? '请求超时' : '网络连接失败',
            icon: 'none'
          })
        }
        reject(lastError || new Error('网络连接失败'))
        return
      }

      uni.request({
        url: `${BASE_URLS[index]}${options.url}`,
        method,
        data: options.data || {},
        timeout,
        header: {
          'Content-Type': 'application/json',
          'x-device-id': getDeviceId(),
          ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
          ...(options.header || {})
        },
        success: (res) => {
          if (res.statusCode === 200) {
            if (res.data.code === 0) {
              resolve(res.data.data)
              return
            }

            if (shouldRefreshSession(options, res)) {
              handleAuthFailure(res.data?.message || '请先登录')
              reject(res.data)
              return
            }

            uni.showToast({
              title: res.data?.message || '请求失败',
              icon: 'none'
            })
            reject(res.data)
            return
          }

          if (res.statusCode === 401) {
            handleAuthFailure('请先登录')
            reject(res)
            return
          }

          uni.showToast({
            title: '网络错误',
            icon: 'none'
          })
          reject(res)
        },
        fail: (err) => {
          tryRequest(index + 1, err)
        }
      })
    }

    tryRequest(0)
  })

  if (dedupeEnabled) {
    inFlightRequests.set(requestKey, pendingRequest)
  }

  // 使用双分支 then 清理请求，避免 finally 返回一个未处理的拒绝 Promise。
  pendingRequest.then(
    () => {
      if (dedupeEnabled) {
        inFlightRequests.delete(requestKey)
      }
    },
    () => {
      if (dedupeEnabled) {
        inFlightRequests.delete(requestKey)
      }
    }
  )

  return pendingRequest
}

export default request
