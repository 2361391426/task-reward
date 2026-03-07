// 图片上传工具
const UPLOAD_URL = 'https://your-api-domain.com/api/upload'

/**
 * 上传图片
 * @param {String} filePath 本地文件路径
 * @returns {Promise} 返回图片URL
 */
export const uploadImage = (filePath) => {
  return new Promise((resolve, reject) => {
    uni.showLoading({ title: '上传中...' })
    
    uni.uploadFile({
      url: UPLOAD_URL,
      filePath: filePath,
      name: 'file',
      header: {
        'Authorization': uni.getStorageSync('token') || ''
      },
      success: (res) => {
        uni.hideLoading()
        const data = JSON.parse(res.data)
        if (data.code === 0) {
          resolve(data.data.url)
        } else {
          uni.showToast({
            title: data.message || '上传失败',
            icon: 'none'
          })
          reject(data)
        }
      },
      fail: (err) => {
        uni.hideLoading()
        uni.showToast({
          title: '上传失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

/**
 * 选择并上传图片
 * @param {Number} count 最多选择数量
 * @returns {Promise} 返回图片URL数组
 */
export const chooseAndUploadImage = (count = 1) => {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count: count,
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
