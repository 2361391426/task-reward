<script>
import { wxLogin } from './api/user.js'

export default {
  onLaunch: function() {
    console.log('App Launch')
    this.checkLogin()
  },
  onShow: function() {
    console.log('App Show')
  },
  onHide: function() {
    console.log('App Hide')
  },
  methods: {
    async checkLogin() {
      const token = uni.getStorageSync('token')
      if (!token) {
        // 自动登录
        await this.autoLogin()
      }
    },

    async autoLogin() {
      try {
        // 获取微信登录凭证
        const loginRes = await uni.login()
        if (loginRes.code) {
          // 调用后端登录接口
          const res = await wxLogin(loginRes.code)
          // 保存 token
          uni.setStorageSync('token', res.token)
          uni.setStorageSync('userInfo', res.user)
          console.log('自动登录成功')
        }
      } catch (error) {
        console.error('自动登录失败', error)
      }
    }
  }
}
</script>

<style>
@import './static/css/common.css';
</style>
