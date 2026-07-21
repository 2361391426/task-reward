<script>
import { getUserInfo } from '../api/user.js'
import { resumePendingUploads } from '../utils/upload.js'

const IS_DEV = import.meta.env.DEV

export default {
  onLaunch() {
    if (!IS_DEV) {
      void this.bootstrapApp()
      resumePendingUploads().catch((error) => {
        console.error('恢复待上传文件失败', error)
      })
    }
  },
  onShow() {},
  onHide() {},
  methods: {
    async bootstrapApp() {
      try {
        await this.checkLogin()
      } catch (error) {
        console.error('应用启动检查失败', error)
      }
    },

    async syncUserInfo(baseInfo = {}, allowFallback = false) {
      try {
        const latestInfo = await getUserInfo()
        const mergedInfo = {
          ...(baseInfo || {}),
          ...(latestInfo || {})
        }
        uni.setStorageSync('userInfo', mergedInfo)
        return mergedInfo
      } catch (error) {
        if (allowFallback && baseInfo && Object.keys(baseInfo).length > 0) {
          uni.setStorageSync('userInfo', baseInfo)
          return baseInfo
        }
        throw error
      }
    },

    async checkLogin() {
      const token = uni.getStorageSync('token')
      if (!token) {
        uni.removeStorageSync('userInfo')
        return
      }

      try {
        await this.syncUserInfo({}, false)
      } catch (error) {
        uni.removeStorageSync('token')
        uni.removeStorageSync('userInfo')
      }
    }
  }
}
</script>

<style>
@import '../static/css/common.css';
</style>
