<script>
import { wxLogin, getUserInfo } from './api/user.js'

export default {
  onLaunch() {
    this.checkLogin()
  },
  onShow() {},
  onHide() {},
  methods: {
    async checkLogin() {
      const token = uni.getStorageSync('token')
      if (!token) {
        await this.autoLogin()
        return
      }

      try {
        await getUserInfo()
      } catch (error) {
        uni.removeStorageSync('token')
        uni.removeStorageSync('userInfo')
        await this.autoLogin()
      }
    },

    autoLogin() {
      return new Promise((resolve, reject) => {
        uni.login({
          success: async (loginRes) => {
            if (!loginRes.code) {
              reject(new Error('未获取到登录凭证'))
              return
            }

            try {
              const res = await wxLogin(loginRes.code)
              uni.setStorageSync('token', res.token)
              uni.setStorageSync('userInfo', res.user)
              resolve(res)
            } catch (error) {
              console.error('自动登录失败', error)
              reject(error)
            }
          },
          fail: reject
        })
      })
    }
  }
}
</script>

<style>
@import './static/css/common.css';
</style>
