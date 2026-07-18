const IS_DEV = !!import.meta.env.DEV || import.meta.env.MODE === 'development' || import.meta.env.VITE_LOCAL_DEBUG_LOGIN === 'true'
const IS_WEIXIN_MP = typeof wx !== 'undefined' && typeof wx.uploadFile === 'function'
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

  if (IS_DEV) {
    urls.push(...DEFAULT_DEV_BASE_URLS.map(normalizeBaseUrl))
  }
  if (!IS_WEIXIN_MP) {
    urls.push('/api')
  }

  return [...new Set(urls.filter(Boolean))]
}

const BASE_URLS = buildBaseUrlList()
const UPLOAD_QUEUE_KEY = 'task-reward:pending-uploads'
const MAX_UPLOAD_RETRIES = 3
const MAX_CONCURRENT_UPLOADS = 2

const getAuthHeader = () => {
  const token = uni.getStorageSync('token') || ''
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

const readQueue = () => {
  try {
    const raw = uni.getStorageSync(UPLOAD_QUEUE_KEY)
    return Array.isArray(raw) ? raw : JSON.parse(raw || '[]')
  } catch (error) {
    return []
  }
}

const saveQueue = (queue) => {
  uni.setStorageSync(UPLOAD_QUEUE_KEY, JSON.stringify(queue || []))
}

const enqueueUpload = (filePath) => {
  const queue = readQueue()
  if (queue.some(item => item.filePath === filePath)) return
  queue.push({
    filePath,
    createdAt: Date.now()
  })
  saveQueue(queue)
}

const compressImageIfNeeded = async (filePath) => {
  if (typeof uni.compressImage !== 'function') {
    return filePath
  }

  try {
    const result = await new Promise((resolve, reject) => {
      uni.compressImage({
        src: filePath,
        quality: 80,
        success: resolve,
        fail: reject
      })
    })
    return result.tempFilePath || filePath
  } catch (error) {
    return filePath
  }
}

const uploadOnce = async (filePath) => {
  const uploadPath = await compressImageIfNeeded(filePath)

  return new Promise((resolve, reject) => {
    const attemptUpload = (index, lastError = null) => {
      if (index >= BASE_URLS.length) {
        reject(lastError || new Error('上传失败'))
        return
      }

      uni.uploadFile({
        url: `${BASE_URLS[index]}/upload`,
        filePath: uploadPath,
        name: 'file',
        header: {
          Authorization: getAuthHeader()
        },
        success: (res) => {
          let data = null
          try {
            data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
          } catch (parseError) {
            reject(parseError)
            return
          }

          if (data.code === 0) {
            resolve(data.data.url)
            return
          }

          reject(new Error(data.message || '上传失败'))
        },
        fail: (error) => {
          attemptUpload(index + 1, error)
        }
      })
    }

    attemptUpload(0)
  })
}

const uploadWithRetry = async (filePath) => {
  let lastError = null
  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt += 1) {
    try {
      return await uploadOnce(filePath)
    } catch (error) {
      lastError = error
      const wait = Math.min(1500 * attempt, 4000)
      if (attempt < MAX_UPLOAD_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, wait))
      }
    }
  }
  throw lastError || new Error('上传失败')
}

const uploadFilesWithLimit = async (filePaths = [], limit = MAX_CONCURRENT_UPLOADS) => {
  const queue = Array.isArray(filePaths) ? [...filePaths] : []
  if (!queue.length) return []

  const results = new Array(queue.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (cursor < queue.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await uploadWithRetry(queue[currentIndex])
    }
  })

  await Promise.all(workers)
  return results
}

export const resumePendingUploads = async () => {
  const queue = readQueue()
  if (!queue.length || !BASE_URLS.length) return []

  const remaining = []
  const results = []

  for (const item of queue) {
    try {
      const url = await uploadWithRetry(item.filePath)
      results.push({ filePath: item.filePath, url })
    } catch (error) {
      remaining.push(item)
    }
  }

  saveQueue(remaining)
  return results
}

export const uploadImage = async (filePath) => {
  try {
    return await uploadWithRetry(filePath)
  } catch (error) {
    enqueueUpload(filePath)
    uni.showToast({
      title: '上传失败，稍后重试',
      icon: 'none'
    })
    throw error
  }
}

export const chooseAndUploadImage = (count = 1) => {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        try {
          const urls = await uploadFilesWithLimit(res.tempFilePaths)
          resolve(urls)
        } catch (error) {
          reject(error)
        }
      },
      fail: reject
    })
  })
}
