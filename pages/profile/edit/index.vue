<template>
  <view class="profile-edit-page">
    <view class="profile-hero">
      <view class="avatar-wrap" @click="chooseCustomAvatar">
        <image
          class="avatar"
          :src="form.avatar || userInfo.avatar || '/static/images/default-avatar.png'"
          mode="aspectFill"
        />
        <text class="avatar-tip">点击更换头像</text>
        <text class="avatar-desc">支持同步微信头像，或上传 3MB 以内的自定义头像</text>
      </view>
    </view>

    <view class="form-card">
      <view class="field-row">
        <text class="field-label">昵称</text>
        <input
          class="field-input"
          v-model="form.nickname"
          maxlength="32"
          placeholder="请输入昵称"
          placeholder-class="field-placeholder"
        />
      </view>
      <view class="field-row field-row-border">
        <text class="field-label">手机号</text>
        <input
          class="field-input"
          v-model="form.phone"
          type="number"
          maxlength="11"
          placeholder="请输入手机号"
          placeholder-class="field-placeholder"
        />
      </view>
    </view>

    <view class="action-card">
      <button
        class="action-btn ghost"
        :loading="syncing"
        :disabled="syncing || saving || uploading"
        @click="syncNativeProfile"
      >
        同步微信资料
      </button>
      <button
        class="action-btn primary"
        :loading="saving"
        :disabled="saving || uploading"
        @click="saveProfile"
      >
        保存修改
      </button>
    </view>

    <view class="notice-card">
      <text class="notice-text">当前支持修改头像、昵称和手机号，保存后会同步到“我的”页面。</text>
    </view>
  </view>
</template>

<script>
import { getUserInfo, updateUserInfo } from '../../../api/user.js'
import { uploadImage } from '../../../utils/upload.js'

const PHONE_REGEXP = /^1\d{10}$/

export default {
  data() {
    return {
      userInfo: {},
      form: {
        nickname: '',
        avatar: '',
        phone: ''
      },
      syncing: false,
      saving: false,
      uploading: false
    }
  },

  onLoad() {
    this.loadProfile()
  },

  onShow() {
    this.loadProfile(false)
  },

  methods: {
    hasToken() {
      try {
        return Boolean(uni.getStorageSync('token'))
      } catch (error) {
        return false
      }
    },

    ensureLoggedIn() {
      if (this.hasToken()) {
        return true
      }
      uni.showToast({ title: '请先登录', icon: 'none' })
      setTimeout(() => {
        uni.switchTab({ url: '/pages/my/index' })
      }, 200)
      return false
    },

    fillForm(source = {}) {
      this.form = {
        nickname: source.nickname || '',
        avatar: source.avatar || '',
        phone: source.phone_raw || source.phone_plain || source.phone || ''
      }
    },

    applyProfile(source = {}, options = {}) {
      const nextUser = {
        ...this.userInfo,
        ...(source || {})
      }
      this.userInfo = nextUser
      this.fillForm(nextUser)
      try {
        uni.setStorageSync('userInfo', nextUser)
      } catch (error) {}
      if (options.emit !== false) {
        uni.$emit('user-info-updated', nextUser)
      }
      return nextUser
    },

    loadProfile(fetchRemote = true) {
      if (!this.ensureLoggedIn()) {
        return
      }

      try {
        const cached = uni.getStorageSync('userInfo')
        const parsed = cached ? (typeof cached === 'string' ? JSON.parse(cached) : cached) : {}
        if (parsed && typeof parsed === 'object') {
          this.applyProfile(parsed, { emit: false })
        }
      } catch (error) {
        console.error('读取本地用户资料失败', error)
      }

      if (fetchRemote) {
        this.fetchLatestProfile()
      }
    },

    async fetchLatestProfile() {
      if (!this.hasToken()) {
        return
      }

      try {
        const res = await getUserInfo()
        if (res && typeof res === 'object') {
          this.applyProfile(res)
        }
      } catch (error) {
        console.error('获取最新用户资料失败', error)
      }
    },

    async requestNativeProfile() {
      const api =
        typeof wx !== 'undefined' && typeof wx.getUserProfile === 'function'
          ? wx.getUserProfile
          : (typeof uni.getUserProfile === 'function' ? uni.getUserProfile : null)

      if (!api) {
        throw new Error('当前环境不支持微信头像昵称授权，请在微信内打开')
      }

      const profileRes = await new Promise((resolve, reject) => {
        api({
          desc: '用于同步昵称和头像',
          success: resolve,
          fail: reject
        })
      })

      const userInfo = profileRes?.userInfo || profileRes || {}
      return {
        nickname: userInfo.nickName || userInfo.nickname || '',
        avatar: userInfo.avatarUrl || userInfo.avatar || ''
      }
    },

    async syncNativeProfile() {
      if (!this.ensureLoggedIn() || this.syncing || this.saving || this.uploading) {
        return
      }

      try {
        this.syncing = true
        const profile = await this.requestNativeProfile()
        this.form.nickname = profile.nickname || this.form.nickname
        this.form.avatar = profile.avatar || this.form.avatar
        const saved = await this.saveProfile(true)
        if (saved) {
          uni.showToast({ title: '微信资料已同步', icon: 'success' })
        }
      } catch (error) {
        if (String(error?.errMsg || '').includes('cancel')) {
          return
        }
        uni.showToast({ title: error?.message || '同步失败，请重试', icon: 'none' })
      } finally {
        this.syncing = false
      }
    },

    async chooseCustomAvatar() {
      if (!this.ensureLoggedIn() || this.uploading || this.saving) {
        return
      }

      try {
        this.uploading = true
        const res = await new Promise((resolve, reject) => {
          uni.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject
          })
        })

        const tempFile = Array.isArray(res?.tempFiles) ? res.tempFiles[0] : null
        if (tempFile?.size && tempFile.size > 3 * 1024 * 1024) {
          uni.showToast({ title: '头像图片不能超过3MB', icon: 'none' })
          return
        }

        const filePath = res?.tempFilePaths?.[0]
        if (!filePath) {
          throw new Error('未选择头像图片')
        }

        const avatarUrl = await uploadImage(filePath)
        this.form.avatar = avatarUrl
        const saved = await this.saveProfile(true)
        if (saved) {
          uni.showToast({ title: '头像已更新', icon: 'success' })
        }
      } catch (error) {
        if (String(error?.errMsg || '').includes('cancel')) {
          return
        }
        uni.showToast({ title: error?.message || '头像上传失败', icon: 'none' })
      } finally {
        this.uploading = false
      }
    },

    async saveProfile(silent = false) {
      if (!this.ensureLoggedIn()) {
        return false
      }

      const nickname = String(this.form.nickname || '').trim()
      const avatar = String(this.form.avatar || '').trim()
      const phone = String(this.form.phone || '').trim()

      if (!nickname) {
        uni.showToast({ title: '昵称不能为空', icon: 'none' })
        return false
      }

      if (nickname.length > 32) {
        uni.showToast({ title: '昵称不能超过32个字符', icon: 'none' })
        return false
      }

      if (phone && !PHONE_REGEXP.test(phone)) {
        uni.showToast({ title: '请输入正确的11位手机号', icon: 'none' })
        return false
      }

      try {
        this.saving = true
        const res = await updateUserInfo({ nickname, avatar, phone })
        const nextUser = {
          ...this.userInfo,
          ...(res || {}),
          nickname: res?.nickname || nickname,
          avatar: res?.avatar || avatar,
          phone: res?.phone || this.userInfo.phone || '',
          phone_raw: res?.phone_raw || phone
        }
        this.applyProfile(nextUser)
        if (!silent) {
          uni.showToast({ title: '保存成功', icon: 'success' })
        }
        return true
      } catch (error) {
        uni.showToast({ title: error?.message || '保存失败，请重试', icon: 'none' })
        return false
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.profile-edit-page {
  min-height: 100vh;
  padding: 32rpx 24rpx 40rpx;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.1), transparent 36%),
    linear-gradient(180deg, #f7f9fc 0%, #eef3fb 100%);
  box-sizing: border-box;
}

.profile-hero {
  padding: 36rpx 0 24rpx;
  display: flex;
  justify-content: center;
}

.avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar {
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: #eef2f7;
  box-shadow: 0 24rpx 48rpx rgba(15, 23, 42, 0.08);
}

.avatar-tip {
  margin-top: 24rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}

.avatar-desc {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: #6b7280;
  text-align: center;
}

.form-card,
.action-card,
.notice-card {
  background: rgba(255, 255, 255, 0.96);
  border-radius: 28rpx;
  box-shadow: 0 18rpx 40rpx rgba(15, 23, 42, 0.06);
}

.form-card {
  padding: 8rpx 28rpx;
}

.field-row {
  display: flex;
  align-items: center;
  min-height: 112rpx;
}

.field-row-border {
  border-top: 1rpx solid #e5e7eb;
}

.field-label {
  width: 120rpx;
  font-size: 30rpx;
  color: #111827;
  font-weight: 600;
}

.field-input {
  flex: 1;
  font-size: 30rpx;
  color: #111827;
}

.field-placeholder {
  color: #9ca3af;
}

.action-card {
  margin-top: 28rpx;
  padding: 24rpx;
  display: flex;
  gap: 20rpx;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 600;
}

.action-btn::after {
  border: none;
}

.action-btn.ghost {
  color: #1d4ed8;
  background: rgba(59, 130, 246, 0.1);
}

.action-btn.primary {
  color: #ffffff;
  background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
}

.notice-card {
  margin-top: 24rpx;
  padding: 24rpx 28rpx;
}

.notice-text {
  font-size: 26rpx;
  line-height: 1.7;
  color: #64748b;
}
</style>
