// Image upload helper
const UPLOAD_URL = import.meta.env.VITE_UPLOAD_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/upload'

const getAuthHeader = () => {
  const token = uni.getStorageSync('token') || ''
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

export const uploadImage = (filePath) => {
  return new Promise((resolve, reject) => {
    uni.showLoading({ title: 'Uploading...' })

    uni.uploadFile({
      url: UPLOAD_URL,
      filePath,
      name: 'file',
      header: {
        Authorization: getAuthHeader()
      },
      success: (res) => {
        uni.hideLoading()
        let data = null
        try {
          data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        } catch (parseError) {
          console.error('Failed to parse upload response', parseError, res.data)
          uni.showToast({
            title: 'Upload response format error',
            icon: 'none'
          })
          reject(parseError)
          return
        }

        if (data.code === 0) {
          resolve(data.data.url)
        } else {
          uni.showToast({
            title: data.message || 'Upload failed',
            icon: 'none'
          })
          reject(data)
        }
      },
      fail: (err) => {
        uni.hideLoading()
        uni.showToast({
          title: 'Upload failed',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

export const chooseAndUploadImage = (count = 1) => {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        try {
          const uploadPromises = res.tempFilePaths.map(path => uploadImage(path))
          const urls = await Promise.all(uploadPromises)
          resolve(urls)
        } catch (error) {
          reject(error)
        }
      },
      fail: reject
    })
  })
}
