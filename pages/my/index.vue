<template>
  <view class="container my-page">
    <view class="profile-card card" @click="handleProfileTap">
      <image class="profile-avatar" :src="userInfo.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
      <view class="profile-body">
        <text class="profile-name">{{ userInfo.nickname || '未登录' }}</text>
        <text class="profile-subtitle">
          {{ isLoggedIn ? (userInfo.phone || '未绑定手机号') : '点击头像登录并同步信息' }}
        </text>
      </view>
      <uni-icons type="right" size="16" color="#9aa1a8" />
    </view>

    <view v-if="!isLoggedIn" class="panel card login-panel">
      <view class="login-panel-header">
        <text class="login-panel-title">微信授权登录</text>
        <text class="login-panel-desc">点击按钮后完成微信登录，登录成功后可再单独授权手机号</text>
      </view>
      <view class="login-actions">
        <button
          class="btn-login primary"
          :loading="quickLoginLoading"
          :disabled="quickLoginLoading"
          @click="handleQuickLogin"
        >
          立即登录
        </button>
      </view>
    </view>

    <view v-else-if="!userInfo.phone" class="panel card login-panel">
      <view class="login-panel-header">
        <text class="login-panel-title">手机号授权</text>
        <text class="login-panel-desc">微信官方授权后可自动回显手机号，并用于参与资格校验</text>
      </view>
      <view class="login-actions">
        <button
          class="btn-login primary"
          open-type="getPhoneNumber"
          :loading="bindingPhone"
          :disabled="bindingPhone"
          @getphonenumber="handleGetPhoneNumber"
        >
          授权手机号
        </button>
      </view>
    </view>

    <view class="wallet-card card">
      <view class="wallet-main">
        <text class="wallet-title">积分兑换</text>
        <text class="wallet-amount">{{ Number(userInfo.available_balance || 0).toFixed(2) }}积分</text>
      </view>
      <view class="wallet-side">
        <text class="wallet-link" @click="goWithdraw">查看明细</text>
        <button class="wallet-btn" @click="goWithdraw">申请兑换</button>
      </view>
    </view>

    <view class="panel card">
      <view class="panel-header">
        <text class="panel-title">我的发布</text>
      </view>
      <view class="quick-grid">
        <view
          v-for="item in issuerActions"
          :key="item.key"
          class="quick-item"
          @click="handleFeatureAction(item.key)"
        >
          <uni-icons class="quick-icon" :type="item.iconType" :color="item.iconColor" size="24" />
          <text class="quick-text">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view class="panel card">
      <view class="panel-header">
        <text class="panel-title">我的参与</text>
      </view>
      <view class="quick-grid">
        <view
          v-for="item in receiverActions"
          :key="item.key"
          class="quick-item"
          @click="handleFeatureAction(item.key)"
        >
          <uni-icons class="quick-icon" :type="item.iconType" :color="item.iconColor" size="24" />
          <text class="quick-text">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view class="panel card">
      <view class="panel-header">
        <text class="panel-title">功能中心</text>
      </view>
      <view class="utility-grid">
        <view class="utility-item" @click="handleLogout">
          <uni-icons class="utility-icon" type="closeempty" color="#f56c6c" size="24" />
          <text class="utility-text">退出登录</text>
        </view>
        <view class="utility-item" @click="openFeedback">
          <uni-icons class="utility-icon" type="compose" color="#409eff" size="24" />
          <text class="utility-text">意见反馈</text>
        </view>
        <view class="utility-item" @click="openHelp">
          <uni-icons class="utility-icon" type="help" color="#f39c12" size="24" />
          <text class="utility-text">帮助中心</text>
        </view>
      </view>
    </view>

    <view v-if="loadError" class="error-panel">
      <text class="error-title">加载失败</text>
      <text class="error-text">{{ loadError }}</text>
      <button class="btn-secondary" @click="retryLoad">重试</button>
    </view>
  </view>
</template>

<script>
import { getMySubmissions } from '../../api/task.js'
import { bindUserPhone, getEarnings, getUserInfo, updateUserInfo, wxLogin } from '../../api/user.js'
import { getTaskList } from '../../api/task.js'
import { getMerchantTasks } from '../../api/merchant.js'
import { formatTime, platformText, submissionStatusText } from '../../utils/format.js'
import { isMerchantSession } from '../../utils/session.js'
import { uploadImage } from '../../utils/upload.js'
import { requestTaskSubscribeMessage } from '../../utils/subscribe.js'

const IS_DEV = !!import.meta.env.DEV || import.meta.env.MODE === 'development' || import.meta.env.VITE_LOCAL_DEBUG_LOGIN === 'true'

export default {
  data() {
    return {
      userInfo: {},
      loading: false,
      hasLoadedData: false,
      currentTab: 0,
      quickLoginLoading: false,
      profileSyncLoading: false,
      profileSaving: false,
      avatarUploading: false,
      bindingPhone: false,
      logoutLoading: false,
      agreeChecked: false,
      rememberedPhone: '',
      profileForm: {
        nickname: '',
        avatar: ''
      },
      sessionVersion: 0,
      userInfoUpdateListener: null,
      publishFilterKey: 'all',
      allPublishTasks: [],
      publishLoading: false,
      tabs: [
        { name: '全部', status: null, count: 0 },
        { name: '待审核', status: 0, count: 0 },
        { name: '已通过', status: 1, count: 0 },
        { name: '已驳回', status: 2, count: 0 }
      ],
      submissionList: [],
      allSubmissions: [],
      tabStorageKey: 'task-reward:last-my-tab',
      loadError: ''
    }
  },

  computed: {
    isLoggedIn() {
      this.sessionVersion
      try {
        return Boolean(uni.getStorageSync('token'))
      } catch (error) {
        return false
      }
    },

    canPublishTasks() {
      return Number(this.userInfo?.publish_permission || 0) === 1 || isMerchantSession()
    },

    publishStats() {
      const tasks = Array.isArray(this.allPublishTasks) ? this.allPublishTasks : []
      const stats = {
        total: tasks.length,
        pending: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        submissionCount: 0,
        pendingReview: 0,
        approved: 0,
        rejected: 0
      }

      tasks.forEach((item) => {
        const status = Number(item.status || 1)
        const remainingQuota = Number(item.remaining_quota || 0)
        const acceptStatus = String(item.accept_status || '')
        stats.submissionCount += Number(item.submission_count || 0)
        stats.pendingReview += Number(item.pending_review || 0)
        stats.approved += Number(item.approved || 0)
        stats.rejected += Number(item.rejected || 0)

        if (status === 2) {
          stats.cancelled += 1
          return
        }

        if (status === 3 || remainingQuota <= 0) {
          stats.completed += 1
          return
        }

        if (acceptStatus === 'accept_pending' || item.publication_status === 'pending') {
          stats.pending += 1
          return
        }

        stats.active += 1
      })

      return stats
    },

    issuerActions() {
      return [
        { key: 'publish_review', label: '审核中心', iconType: 'gear-filled', iconColor: '#8b5cf6' },
        { key: 'publish_all', label: '全部订单', iconType: 'list', iconColor: '#409eff' },
        { key: 'publish_pending', label: '待参与', iconType: 'redo', iconColor: '#e6a23c' },
        { key: 'publish_progress', label: '进行中', iconType: 'refresh', iconColor: '#67c23a' },
        { key: 'publish_completed', label: '已完成', iconType: 'checkbox-filled', iconColor: '#67c23a' },
        { key: 'publish_cancelled', label: '已撤销', iconType: 'closeempty', iconColor: '#f56c6c' }
      ]
    },

    receiverActions() {
      return [
        { key: 'all_orders', label: '全部记录', iconType: 'list', iconColor: '#409eff' },
        { key: 'pending', label: '待审核', iconType: 'redo', iconColor: '#e6a23c' },
        { key: 'approved', label: '已通过', iconType: 'checkbox-filled', iconColor: '#67c23a' },
        { key: 'rejected', label: '已驳回', iconType: 'closeempty', iconColor: '#f56c6c' },
        { key: 'in_progress', label: '进行中', iconType: 'refresh', iconColor: '#67c23a' }
      ]
    },

    activeTasks() {
      return this.allSubmissions
        .filter(item => {
          const status = Number(item.review_status)
          return status === 0 || status === 2
        })
        .sort((a, b) => {
          const statusA = Number(a.review_status)
          const statusB = Number(b.review_status)
          if (statusA !== statusB) {
            return statusA - statusB
          }
          return new Date(b.submit_time || 0) - new Date(a.submit_time || 0)
        })
    },

    filteredPublishTasks() {
      const sorted = [...this.allPublishTasks].sort((a, b) => {
        const timeA = new Date(b.created_at || b.start_time_raw || 0).getTime()
        const timeB = new Date(a.created_at || a.start_time_raw || 0).getTime()
        return timeA - timeB
      })

      return sorted.filter((item) => {
        const status = Number(item.status || 1)
        const remainingQuota = Number(item.remaining_quota || 0)
        const acceptStatus = item.accept_status

        switch (this.publishFilterKey) {
          case 'publish_pending':
            return acceptStatus === 'accept_pending' || item.publication_status === 'pending'
          case 'publish_progress':
            return status === 1 && acceptStatus === 'accept_open'
          case 'publish_completed':
            return status === 3 || remainingQuota <= 0
          case 'publish_cancelled':
            return status === 2
          default:
            return true
        }
      })
    }
  },

  onShow() {
    this.restoreTabState()
    this.loadRememberedAccount()
    this.updateNavigationTitle()
    this.loadCachedUserInfo()
    this.refreshData(true)
  },

  onLoad() {
    this.userInfoUpdateListener = (payload) => {
      if (payload && typeof payload === 'object') {
        this.userInfo = {
          ...this.userInfo,
          ...payload
        }
        this.syncProfileForm(this.userInfo)
      }
      this.loadCachedUserInfo()
      this.refreshData(true)
    }
    uni.$on('user-info-updated', this.userInfoUpdateListener)
  },

  onUnload() {
    if (this.userInfoUpdateListener) {
      uni.$off('user-info-updated', this.userInfoUpdateListener)
      this.userInfoUpdateListener = null
    }
  },

  async onPullDownRefresh() {
    try {
      await this.refreshData(true)
    } finally {
      uni.stopPullDownRefresh()
    }
  },

  methods: {
    async refreshData(forceRefresh = false) {
      this.loadError = ''
      this.loading = true
      if (!this.isLoggedIn) {
        this.userInfo = {
          total_earnings: 0,
          available_balance: 0,
          frozen_balance: 0
        }
        this.syncProfileForm()
        this.allSubmissions = []
        this.submissionList = []
        this.allPublishTasks = []
        this.hasLoadedData = false
        this.loading = false
        return
      }
      if (IS_DEV) {
        this.applyMockData()
        this.loadCachedUserInfo()
        this.loading = false
        return
      }
      try {
        await this.refreshUserProfile()

        const submissions = []
        let page = 1
        let hasMore = true
        const pageSize = 50

        while (hasMore) {
          const res = await getMySubmissions(
            { page, page_size: pageSize },
            { forceRefresh: forceRefresh && page === 1 }
          )
          const pageList = Array.isArray(res && res.list) ? res.list : []
          submissions.push(...pageList)
          const total = res && typeof res.total === 'number' ? res.total : submissions.length
          const returnedPageSize = res && typeof res.page_size === 'number' ? res.page_size : pageSize
          hasMore = submissions.length < total && pageList.length >= returnedPageSize
          page += 1
          if (!hasMore) {
            break
          }
        }

        this.allSubmissions = submissions || []
        this.updateTabCounts()
        this.filterSubmissions()
        if (this.canPublishTasks) {
          await this.loadPublishTasks(forceRefresh)
        } else {
          this.allPublishTasks = []
          this.publishFilterKey = 'all'
        }
        this.hasLoadedData = true
      } catch (error) {
          console.error('加载我的数据失败', error)
          this.loadError = '我的数据加载失败，请重试'
        } finally {
        this.loading = false
      }
    },

    loadRememberedAccount() {
      try {
        const storedPhone = uni.getStorageSync('task-reward:last-login-phone')
          || uni.getStorageSync('task-reward:phone-number')
          || ''
        this.rememberedPhone = String(storedPhone || '')
      } catch (error) {
        this.rememberedPhone = ''
      }
    },

    updateNavigationTitle() {
      uni.setNavigationBarTitle({
        title: '我的'
      })
    },

    updateTabCounts() {
      this.tabs[0].count = this.allSubmissions.length
      this.tabs[1].count = this.allSubmissions.filter(item => Number(item.review_status) === 0).length
      this.tabs[2].count = this.allSubmissions.filter(item => Number(item.review_status) === 1).length
      this.tabs[3].count = this.allSubmissions.filter(item => Number(item.review_status) === 2).length
    },

    switchTab(index) {
      this.currentTab = index
      try {
        uni.setStorageSync(this.tabStorageKey, String(index))
      } catch (error) {}
      this.filterSubmissions()
    },

    restoreTabState() {
      try {
        const saved = Number(uni.getStorageSync(this.tabStorageKey))
        if (Number.isInteger(saved) && saved >= 0 && saved < this.tabs.length) {
          this.currentTab = saved
        }
      } catch (error) {}
    },

    filterSubmissions() {
      const status = this.tabs[this.currentTab].status
      this.submissionList = status === null
        ? this.allSubmissions
        : this.allSubmissions.filter(item => Number(item.review_status) === Number(status))
    },

    getStatusText(status) {
      return submissionStatusText(status)
    },

    platformText(platform) {
      return platformText(platform)
    },

    formatTime(time) {
      return formatTime(time)
    },

    getSubmissionId(item) {
      if (!item) return ''
      return item.id || item.submission_id || item.submissionId || ''
    },

    handleFeatureAction(key) {
      switch (key) {
        case 'publish_review':
          if (!this.canPublishTasks) {
            uni.showToast({ title: '请联系管理员开通权限', icon: 'none' })
            return
          }
          this.goOrderCenter('pending')
          return
        case 'publish_all':
          if (!this.canPublishTasks) {
            uni.showToast({ title: '请联系管理员开通权限', icon: 'none' })
            return
          }
          this.goPublishCenter('all')
          return
        case 'publish_pending':
          if (!this.canPublishTasks) {
            uni.showToast({ title: '请联系管理员开通权限', icon: 'none' })
            return
          }
          this.goPublishCenter('publish_pending')
          return
        case 'publish_progress':
          if (!this.canPublishTasks) {
            uni.showToast({ title: '请联系管理员开通权限', icon: 'none' })
            return
          }
          this.goPublishCenter('publish_progress')
          return
        case 'publish_completed':
          if (!this.canPublishTasks) {
            uni.showToast({ title: '请联系管理员开通权限', icon: 'none' })
            return
          }
          this.goPublishCenter('publish_completed')
          return
        case 'publish_cancelled':
          if (!this.canPublishTasks) {
            uni.showToast({ title: '请联系管理员开通权限', icon: 'none' })
            return
          }
          this.goPublishCenter('publish_cancelled')
          return
        case 'all_orders':
          this.goOrderCenter('all')
          return
        case 'pending':
          this.goOrderCenter('pending')
          return
        case 'approved':
          this.goOrderCenter('approved')
          return
        case 'rejected':
          this.goOrderCenter('rejected')
          return
        case 'in_progress':
          this.goOrderCenter('in_progress')
          return
        default:
          uni.showToast({ title: '功能暂未开放', icon: 'none' })
      }
    },

    loadCachedUserInfo() {
      try {
        const cached = uni.getStorageSync('userInfo')
        if (!cached) return
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached
        if (parsed && typeof parsed === 'object') {
          this.userInfo = {
            ...this.userInfo,
            ...parsed
          }
          this.syncProfileForm(this.userInfo)
        }
      } catch (error) {}
    },

    touchSessionState() {
      this.sessionVersion += 1
    },

    applyUserProfile(profile = {}, options = {}) {
      const nextUser = {
        ...this.userInfo,
        ...(profile || {}),
        total_earnings: profile.total_earnings ?? this.userInfo.total_earnings ?? 0,
        available_balance: profile.available_balance ?? this.userInfo.available_balance ?? 0,
        frozen_balance: profile.frozen_balance ?? this.userInfo.frozen_balance ?? 0
      }

      this.userInfo = nextUser
      this.syncProfileForm(nextUser)
      try {
        uni.setStorageSync('userInfo', nextUser)
      } catch (error) {}
      if (options.emit === true) {
        uni.$emit('user-info-updated', nextUser)
      }
      if (nextUser.phone) {
        this.rememberLoginPhone(nextUser.phone)
      }
      this.touchSessionState()
      return nextUser
    },

    async refreshUserProfile() {
      if (!this.isLoggedIn) {
        return null
      }

      let profile = {}
      try {
        profile = await getUserInfo()
      } catch (error) {
        console.error('刷新用户资料失败', error)
        return this.userInfo
      }

      let earnings = {}
      try {
        earnings = await getEarnings()
      } catch (error) {
        console.error('加载积分信息失败', error)
      }

      return this.applyUserProfile({
        ...(profile || {}),
        total_earnings: earnings?.total_earnings ?? profile?.total_earnings ?? 0,
        available_balance: earnings?.available_balance ?? profile?.available_balance ?? 0,
        frozen_balance: earnings?.frozen_balance ?? profile?.frozen_balance ?? 0
      })
    },

    goTaskHall() {
      uni.switchTab({
        url: '/pages/index/index'
      })
    },

    applyMockData() {
      const currentUser = this.userInfo || {}
      this.userInfo = {
        nickname: currentUser.nickname || '测试用户',
        avatar: currentUser.avatar || '',
        phone: currentUser.phone || '',
        total_earnings: 0,
        available_balance: 0,
        frozen_balance: 0,
        risk_status: 0,
        publish_permission: Number(currentUser.publish_permission || 0)
      }
      this.syncProfileForm()
      this.allSubmissions = [
        {
          id: 1,
          task_title: '内容浏览体验',
          platform: 'douyin',
          review_status: 0,
          submit_time: new Date().toISOString(),
          paid_amount: 3.2,
          reward_amount: 1.5
        },
        {
          id: 2,
          task_title: '商品页面体验',
          platform: 'taobao',
          review_status: 2,
          submit_time: new Date().toISOString(),
          paid_amount: 2.8,
          reward_amount: 1.2
        }
      ]
      this.allPublishTasks = [
        {
          id: 1001,
          title: '内容浏览体验',
          platform: 'douyin',
          status: 1,
          publication_status: 'published',
          publication_status_text: '已发布',
          publication_status_tag_type: 'success',
          accept_status: 'accept_open',
          accept_status_text: '可参与',
          accept_status_tag_type: 'success',
          remaining_quota: 20,
          total_quota: 50,
          reward_amount: 3.2,
          created_at: new Date().toISOString(),
          start_time_raw: new Date().toISOString(),
          end_time_raw: new Date(Date.now() + 86400000).toISOString()
        },
        {
          id: 1002,
          title: '商品页面体验',
          platform: 'taobao',
          status: 2,
          publication_status: 'paused',
          publication_status_text: '已暂停',
          publication_status_tag_type: 'warning',
          accept_status: 'paused',
          accept_status_text: '已暂停',
          accept_status_tag_type: 'warning',
          remaining_quota: 0,
          total_quota: 30,
          reward_amount: 2.8,
          created_at: new Date().toISOString(),
          start_time_raw: new Date().toISOString(),
          end_time_raw: new Date().toISOString()
        }
      ]
      this.updateTabCounts()
      this.filterSubmissions()
      this.publishFilterKey = 'all'
      this.hasLoadedData = true
    },

    syncProfileForm(source = this.userInfo) {
      const data = source || {}
      this.profileForm = {
        nickname: data.nickname || '',
        avatar: data.avatar || ''
      }
    },

    async requestNativeProfile(desc = '用于同步昵称和头像') {
      const getUserProfileApi =
        typeof wx !== 'undefined' && typeof wx.getUserProfile === 'function'
          ? wx.getUserProfile
          : (typeof uni.getUserProfile === 'function' ? uni.getUserProfile : null)

      if (!getUserProfileApi) {
        if (IS_DEV) {
          let parsed = {}
          try {
            const cached = uni.getStorageSync('userInfo') || {}
            parsed = typeof cached === 'string' ? JSON.parse(cached || '{}') : (cached || {})
          } catch (error) {}
          return {
            nickname: parsed.nickname || '测试用户',
            avatar: parsed.avatar || ''
          }
        }
        throw new Error('当前环境不支持微信头像昵称授权，请在微信内打开')
      }

      const profileRes = await new Promise((resolve, reject) => {
        getUserProfileApi({
          desc,
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

    async requestLoginCode() {
      const loginApi =
        typeof wx !== 'undefined' && typeof wx.login === 'function'
          ? wx.login
          : (typeof uni.login === 'function' ? uni.login : null)

      if (!loginApi) {
        if (IS_DEV) {
          return `dev_login_${Date.now()}`
        }
        throw new Error('当前环境不支持微信登录，请在微信内打开')
      }

      try {
        const loginRes = await new Promise((resolve, reject) => {
          loginApi({
            success: resolve,
            fail: reject
          })
        })
        if (!loginRes?.code && IS_DEV) {
          return `dev_login_${Date.now()}`
        }
        if (!loginRes?.code) {
          throw new Error('未获取到登录 code')
        }
        return loginRes.code
      } catch (error) {
        if (IS_DEV) {
          return `dev_login_${Date.now()}`
        }
        throw error
      }
    },

    getCachedLoginProfile() {
      let parsed = {}
      try {
        const cached = uni.getStorageSync('userInfo') || {}
        parsed = typeof cached === 'string' ? JSON.parse(cached || '{}') : (cached || {})
      } catch (error) {}

      return {
        nickname: parsed.nickname || this.userInfo.nickname || '测试用户',
        avatar: parsed.avatar || this.userInfo.avatar || ''
      }
    },

    async syncNativeProfile() {
      if (!this.isLoggedIn) {
        uni.showToast({ title: '请先登录后再同步资料', icon: 'none' })
        return
      }

      if (this.profileSyncLoading || this.profileSaving) {
        return
      }

      try {
        this.profileSyncLoading = true
        const profile = await this.requestNativeProfile('用于同步昵称和头像')
        this.profileForm = {
          nickname: profile.nickname || this.profileForm.nickname || this.userInfo.nickname || '',
          avatar: profile.avatar || this.profileForm.avatar || this.userInfo.avatar || ''
        }
        const saved = await this.saveProfile(true)
        if (saved) {
          uni.showToast({ title: '微信资料已同步', icon: 'success' })
        }
      } catch (error) {
        console.error('同步微信资料失败', error)
        uni.showToast({ title: error?.message || '同步失败，请重试', icon: 'none' })
      } finally {
        this.profileSyncLoading = false
      }
    },

    async chooseCustomAvatar() {
      if (!this.isLoggedIn) {
        uni.showToast({ title: '请先登录后再上传头像', icon: 'none' })
        return
      }

      if (this.avatarUploading || this.profileSaving) {
        return
      }

      try {
        this.avatarUploading = true
        const result = await new Promise((resolve, reject) => {
          uni.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject
          })
        })

        const tempFile = Array.isArray(result?.tempFiles) ? result.tempFiles[0] : null
        if (tempFile?.size && tempFile.size > 3 * 1024 * 1024) {
          uni.showToast({ title: '头像图片不能超过3MB', icon: 'none' })
          return
        }

        const filePath = result?.tempFilePaths?.[0]
        if (!filePath) {
          throw new Error('未选择头像图片')
        }

        const avatarUrl = await uploadImage(filePath)
        this.profileForm.avatar = avatarUrl
        const saved = await this.saveProfile(true)
        if (saved) {
          uni.showToast({ title: '头像已更新', icon: 'success' })
        }
      } catch (error) {
        if (error?.errMsg?.includes('cancel')) {
          return
        }
        console.error('上传头像失败', error)
        uni.showToast({ title: error?.message || '头像上传失败', icon: 'none' })
      } finally {
        this.avatarUploading = false
      }
    },

    async saveProfile(silent = false) {
      if (!this.isLoggedIn) {
        uni.showToast({ title: '请先登录后再保存资料', icon: 'none' })
        return false
      }

      const nickname = String(this.profileForm.nickname || '').trim()
      const avatar = String(this.profileForm.avatar || '').trim()

      if (!nickname) {
        uni.showToast({ title: '昵称不能为空', icon: 'none' })
        return false
      }

      if (nickname.length > 32) {
        uni.showToast({ title: '昵称不能超过32个字符', icon: 'none' })
        return false
      }

      try {
        this.profileSaving = true
        const res = await updateUserInfo({ nickname, avatar })
        const nextUser = {
          ...this.userInfo,
          ...(res || {}),
          nickname: res?.nickname || nickname,
          avatar: res?.avatar || avatar
        }
        this.userInfo = nextUser
        this.syncProfileForm(nextUser)
        uni.setStorageSync('userInfo', nextUser)
        this.updateNavigationTitle()
        if (!silent) {
          uni.showToast({ title: '资料已保存', icon: 'success' })
        }
        return true
      } catch (error) {
        console.error('保存资料失败', error)
        uni.showToast({ title: error?.message || '资料保存失败', icon: 'none' })
        return false
      } finally {
        this.profileSaving = false
      }
    },

    async loadPublishTasks(forceRefresh = false) {
      if (!this.canPublishTasks) {
        this.allPublishTasks = []
        return
      }

      try {
        this.publishLoading = true
        const pageSize = 50

        const loadAllPages = async (loader) => {
          const tasks = []
          let page = 1
          let hasMore = true

          while (hasMore) {
            const res = await loader(page, pageSize)
            const pageList = Array.isArray(res && res.list) ? res.list : []
            tasks.push(...pageList)
            const total = res && typeof res.total === 'number' ? res.total : tasks.length
            const returnedPageSize = res && typeof res.page_size === 'number' ? res.page_size : pageSize
            hasMore = tasks.length < total && pageList.length >= returnedPageSize
            page += 1
          }

          return tasks
        }

        let tasks = []
        const merchantMode = isMerchantSession()

        if (merchantMode) {
          try {
            tasks = await loadAllPages((page, pageSizeValue) => {
              return getMerchantTasks({ page, page_size: pageSizeValue })
            })
          } catch (error) {
            console.warn('商家项目接口加载失败', error)
            this.loadError = '项目发布记录加载失败，请稍后重试'
            tasks = []
          }
        } else {
          tasks = await loadAllPages((page, pageSizeValue) => {
            return getTaskList(
              { include_all: 1, page, page_size: pageSizeValue },
              { forceRefresh: forceRefresh && page === 1 }
            )
          })
        }

        this.allPublishTasks = tasks
      } catch (error) {
        console.error('加载项目发布记录失败', error)
        this.allPublishTasks = []
      } finally {
        this.publishLoading = false
      }
    },

    rememberLoginPhone(phone) {
      const value = String(phone || '').trim()
      if (!value) return
      this.rememberedPhone = value
      try {
        uni.setStorageSync('task-reward:last-login-phone', value)
      } catch (error) {}
    },

    viewSubmission(item) {
      const submissionId = this.getSubmissionId(item)
      if (!submissionId) {
        uni.showToast({ title: '暂无提交记录', icon: 'none' })
        return
      }
      this.cacheSubmissionDetail(item, submissionId)
      uni.navigateTo({
        url: `/pages/submission-detail/index?id=${submissionId}`
      })
    },

    resubmitSubmission(item) {
      const submissionId = this.getSubmissionId(item)
      if (!item || !item.task_id || !submissionId) {
        uni.showToast({ title: '暂无可重新提交的记录', icon: 'none' })
        return
      }
      this.cacheSubmissionDetail(item, submissionId)
      uni.navigateTo({
        url: `/pages/upload/index?taskId=${item.task_id}&submissionId=${submissionId}`
      })
    },

    cacheSubmissionDetail(item, submissionId) {
      if (!item || !submissionId) return
      try {
        uni.setStorageSync(`task-reward:submission-detail:${submissionId}`, JSON.stringify({
          id: submissionId,
          task_id: item.task_id,
          task_title: item.task_title || '',
          platform: item.platform,
          paid_amount: item.paid_amount,
          reward_amount: item.reward_amount,
          submit_time: item.submit_time,
          review_time: item.review_time,
          review_note: item.review_note,
          review_status: item.review_status,
          status: item.review_status,
          reject_reason: item.review_note || item.reject_reason || ''
        }))
      } catch (error) {}
    },

    goWithdraw() {
      uni.navigateTo({
        url: '/pages/withdraw/index'
      })
    },

    async handleQuickLogin() {
      try {
        this.quickLoginLoading = true
        const loginProfile = this.getCachedLoginProfile()
        const loginCode = await this.requestLoginCode()

        let res = null
        let usedLocalFallback = false
        try {
          res = await wxLogin(loginCode, {
            nickname: loginProfile.nickname || '',
            avatar: loginProfile.avatar || ''
          })
        } catch (error) {
          if (!IS_DEV) {
            throw error
          }
          console.warn('开发环境登录接口不可用，使用本地兜底登录', error)
          usedLocalFallback = true
          res = {
            token: `dev-token-${Date.now()}`,
            user: {
              id: 0,
              nickname: loginProfile.nickname || '测试用户',
              avatar: loginProfile.avatar || '',
              phone: '',
              total_earnings: 0,
              available_balance: 0,
              frozen_balance: 0,
              publish_permission: 0
            }
          }
        }

        if (res?.token) {
          uni.setStorageSync('token', res.token)
          this.touchSessionState()
        }

        requestTaskSubscribeMessage()

        let profile = res?.user || {}
        if (!usedLocalFallback) {
          try {
            const freshProfile = await getUserInfo()
            if (freshProfile && typeof freshProfile === 'object') {
              profile = { ...profile, ...freshProfile }
            }
          } catch (error) {
            console.error('登录后获取用户信息失败', error)
          }
        }

        const userInfo = {
          ...profile,
          total_earnings: profile.total_earnings || 0,
          available_balance: profile.available_balance || 0,
          frozen_balance: profile.frozen_balance || 0
        }

        this.applyUserProfile({
          ...this.userInfo,
          ...userInfo,
          nickname: userInfo.nickname || loginProfile.nickname || '未登录',
          avatar: userInfo.avatar || loginProfile.avatar || ''
        })

        this.updateNavigationTitle()
        if (!usedLocalFallback) {
          try {
            await this.refreshData(true)
          } catch (error) {
            console.warn('登录后刷新数据失败，已保留登录态', error)
          }
        }
        uni.showToast({ title: '登录成功', icon: 'success' })
      } catch (error) {
        console.error('微信登录失败', error)
        uni.showToast({ title: error?.message || '微信登录失败，请重试', icon: 'none' })
      } finally {
        this.quickLoginLoading = false
      }
    },

    async handleQuickLoginWithPhone(event) {
      const phoneCode = event?.detail?.code || ''
      const authMessage = event?.detail?.errMsg || ''

      if (!phoneCode && authMessage && !IS_DEV) {
        uni.showToast({ title: '请先授权手机号后登录', icon: 'none' })
        return
      }

      await this.handleQuickLogin()

      if (!this.isLoggedIn || !phoneCode) {
        if (!phoneCode && IS_DEV) {
          console.warn('开发环境未返回手机号授权码，已完成基础登录')
        }
        return
      }

      await this.handleGetPhoneNumber(event)
    },

    handleProfileTap() {
      if (!this.isLoggedIn) {
        this.handleQuickLogin()
        return
      }
      uni.navigateTo({
        url: '/pages/profile/edit/index'
      })
    },

    async handleLogout() {
      if (this.logoutLoading) {
        return
      }

      try {
        await new Promise((resolve) => {
          uni.showModal({
            title: '退出登录',
            content: '确认要退出当前账号吗？',
            confirmText: '退出',
            cancelText: '取消',
            success: resolve,
            fail: () => resolve({ confirm: false })
          })
        }).then((result) => {
          if (!result?.confirm) {
            throw new Error('cancelled')
          }
        })

        this.logoutLoading = true
        uni.removeStorageSync('token')
        uni.removeStorageSync('userInfo')
        uni.removeStorageSync('task-reward:phone-number')
        this.touchSessionState()
        this.userInfo = {}
        this.allSubmissions = []
        this.submissionList = []
        this.allPublishTasks = []
        this.publishFilterKey = 'all'
        this.hasLoadedData = false
        this.loadError = ''
        this.profileForm = {
          nickname: '',
          avatar: ''
        }
        this.updateNavigationTitle()
        uni.showToast({ title: '已退出登录', icon: 'success' })
      } catch (error) {
        if (error?.message !== 'cancelled') {
          console.error('退出登录失败', error)
          uni.showToast({ title: '退出失败', icon: 'none' })
        }
      } finally {
        this.logoutLoading = false
      }
    },

    async handleGetPhoneNumber(event) {
      const code = event?.detail?.code || ''
      if (!code) {
        uni.showToast({ title: '未获取到手机号授权码', icon: 'none' })
        return
      }

      try {
        this.bindingPhone = true
        const res = await bindUserPhone(code)
        const latestPhone = res?.masked_phone || res?.phone || ''
        this.applyUserProfile({
          ...this.userInfo,
          phone: latestPhone || this.userInfo.phone
        })
        if (latestPhone) {
          this.rememberLoginPhone(latestPhone)
        }
        if (res?.phone) {
          try {
            uni.setStorageSync('task-reward:phone-number', res.phone)
          } catch (error) {}
        }
        try {
          const cached = uni.getStorageSync('userInfo')
          const parsed = cached ? (typeof cached === 'string' ? JSON.parse(cached) : cached) : {}
          this.applyUserProfile({
            ...parsed,
            phone: res?.masked_phone || latestPhone || parsed.phone || ''
          })
        } catch (error) {}
        await this.refreshData(true)
        uni.showToast({ title: '手机号绑定成功', icon: 'success' })
      } catch (error) {
        console.error('绑定手机号失败', error)
        if (IS_DEV) {
          uni.showToast({ title: '已登录，手机号待后端连接后同步', icon: 'none' })
          return
        }
        uni.showToast({ title: error?.message || '手机号绑定失败', icon: 'none' })
      } finally {
        this.bindingPhone = false
      }
    },

    openLatestSubmissionDetail() {
      const item = this.submissionList[0] || this.activeTasks[0]
      if (!item) {
        uni.showToast({ title: '暂无提交记录', icon: 'none' })
        return
      }
      this.viewSubmission(item)
    },

    openLatestResubmission() {
      const item = this.submissionList.find(record => Number(record.review_status) === 2) || this.activeTasks[0]
      if (!item) {
        uni.showToast({ title: '暂无可重新提交的记录', icon: 'none' })
        return
      }
      this.resubmitSubmission(item)
    },

    openFeedback() {
      uni.navigateTo({
        url: '/pages/feedback/index'
      })
    },

    openHelp() {
      uni.showModal({
        title: '帮助中心',
        content: '如需帮助，请通过意见反馈提交问题，平台会尽快处理。',
        showCancel: false,
        confirmText: '知道了'
      })
    },

    retryLoad() {
      this.refreshData()
    },

    viewPublishTask(item) {
      if (!item || !item.id) {
        uni.showToast({ title: '项目数据缺失', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/task-detail/index?id=${item.id}`
      })
    },

    goOrderCenter(status = 'all') {
      uni.navigateTo({
        url: `/pages/orders/index?status=${encodeURIComponent(status)}`
      })
    },

    goPublishCenter(filter = 'all') {
      uni.navigateTo({
        url: `/pages/orders/index?kind=publish&filter=${encodeURIComponent(filter)}`
      })
    }
  }
}
</script>

<style scoped>
.my-page {
  padding-top: 20rpx;
}

.page-header {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 28rpx;
}

.page-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 26rpx 24rpx;
  border-radius: 26rpx;
  margin-bottom: 20rpx;
  background: #fff;
  box-shadow: 0 16rpx 36rpx rgba(15, 23, 42, 0.06);
}

.profile-avatar {
  width: 110rpx;
  height: 110rpx;
  border-radius: 50%;
  flex-shrink: 0;
  background: #f1f5f9;
}

.profile-body {
  flex: 1;
}

.profile-name {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #1f2937;
}

.profile-subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.profile-arrow {
  font-size: 40rpx;
  color: #cbd5e1;
  margin-left: 8rpx;
}

.wallet-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 24rpx;
  margin-bottom: 20rpx;
  background: #fff;
}

.wallet-main {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.wallet-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}

.wallet-amount {
  font-size: 46rpx;
  font-weight: 800;
  color: #1f2937;
}

.wallet-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14rpx;
}

.wallet-link {
  font-size: 26rpx;
  color: #4b5563;
}

.wallet-btn {
  width: 150rpx;
  height: 58rpx;
  line-height: 58rpx;
  border-radius: 999rpx;
  background: #fff;
  border: 2rpx solid #5b8def;
  color: #5b8def;
  font-size: 26rpx;
  padding: 0;
}

.panel {
  padding: 24rpx 20rpx 20rpx;
  margin-bottom: 20rpx;
  background: #fff;
}

.panel-header {
  margin-bottom: 18rpx;
}

.panel-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx 10rpx;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 10rpx 0;
}

.quick-icon-image {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(91, 141, 239, 0.12), rgba(91, 141, 239, 0.22));
  display: block;
}

.quick-text {
  font-size: 24rpx;
  color: #374151;
  text-align: center;
  line-height: 1.3;
}

.publish-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-top: 18rpx;
  margin-bottom: 14rpx;
}

.publish-summary-item {
  padding: 18rpx 10rpx;
  border-radius: 18rpx;
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.08), rgba(59, 130, 246, 0.03));
  border: 1rpx solid rgba(148, 163, 184, 0.18);
  text-align: center;
}

.publish-summary-number {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: #1f2937;
}

.publish-summary-label {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #64748b;
}

.publish-list-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 16rpx;
  margin-bottom: 14rpx;
}

.publish-list-title {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
}

.publish-list-desc {
  margin-top: 6rpx;
  display: block;
  font-size: 22rpx;
  color: #64748b;
}

.publish-list-subtitle {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #6b7280;
}

.publish-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.publish-item {
  margin: 0;
  border: 1rpx solid rgba(226, 232, 240, 0.95);
}

.publish-item .item-info {
  gap: 8rpx;
}

.status-stack {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  align-items: flex-end;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 1;
}

.status-publish {
  background: #eff6ff;
  color: #2563eb;
}

.status-accept {
  background: #f8fafc;
  color: #475569;
}

.publish-success,
.accept-success {
  background: #dcfce7;
  color: #166534;
}

.publish-warning,
.accept-warning {
  background: #fef3c7;
  color: #92400e;
}

.publish-danger,
.accept-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.publish-info,
.accept-info {
  background: #e0f2fe;
  color: #0369a1;
}

.publish-locked {
  margin-top: 14rpx;
  padding: 20rpx 18rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  border: 1rpx dashed #cbd5e1;
}

.publish-locked-text {
  font-size: 24rpx;
  color: #64748b;
  line-height: 1.5;
}

.utility-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx 12rpx;
}

.utility-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 18rpx 0 8rpx;
}

.utility-icon-image {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: #f8fafc;
  display: block;
}

.utility-text {
  font-size: 24rpx;
  color: #374151;
}

.container {
  min-height: 100vh;
  padding: 28rpx 24rpx 40rpx;
  box-sizing: border-box;
  background:
    radial-gradient(circle at top, rgba(59, 130, 246, 0.16), transparent 42%),
    linear-gradient(180deg, #f8fbff 0%, #f6f8fc 45%, #f7f8fc 100%);
}

.login-page {
  min-height: calc(100vh - 68rpx);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12rpx 0 20rpx;
}

.login-topbar {
  display: flex;
  justify-content: center;
  padding-top: 12rpx;
}

.login-page-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
}

.login-brand {
  padding: 60rpx 8rpx 20rpx;
  text-align: center;
}

.login-logo {
  width: 96rpx;
  height: 96rpx;
  margin: 0 auto 22rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
  color: #fff;
  font-size: 38rpx;
  font-weight: 700;
  box-shadow: 0 18rpx 36rpx rgba(37, 99, 235, 0.18);
}

.brand-name {
  display: block;
  font-size: 44rpx;
  line-height: 1.2;
  font-weight: 800;
  color: #111827;
  letter-spacing: 2rpx;
}

.brand-desc {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #64748b;
}

.login-account {
  padding: 34rpx 28rpx;
  border-radius: 28rpx;
  margin-top: 18rpx;
  box-shadow: 0 18rpx 40rpx rgba(15, 23, 42, 0.06);
}

.account-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.account-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  flex-shrink: 0;
  background: #f1f5f9;
}

.account-text {
  flex: 1;
}

.account-phone {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.account-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #94a3b8;
}

.login-actions {
  padding-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.btn-login {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
}

.btn-login.primary {
  background: linear-gradient(135deg, #b21e35 0%, #9f1239 100%);
  color: #fff;
  box-shadow: 0 16rpx 30rpx rgba(159, 18, 57, 0.22);
}

.btn-login.outline {
  background: #fff;
  color: #b21e35;
  border: 2rpx solid rgba(159, 18, 57, 0.4);
}

.btn-login.text {
  width: auto;
  background: transparent;
  color: #b21e35;
  line-height: 1;
  height: auto;
  border: 0;
  padding: 12rpx 0;
  border-radius: 0;
  font-size: 28rpx;
}

.agreement-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 24rpx 6rpx 0;
}

.agreement-check {
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  border: 2rpx solid #cbd5e1;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  flex-shrink: 0;
}

.agreement-check.checked {
  background: #b21e35;
  border-color: #b21e35;
}

.agreement-text {
  flex: 1;
  font-size: 24rpx;
  line-height: 1.5;
  color: #475569;
}

.user-card {
  overflow: hidden;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.98), rgba(6, 182, 212, 0.92));
  color: #fff;
  padding-bottom: 20rpx;
}

.risk-banner {
  margin: 18rpx 24rpx 0;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.14);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
}

.risk-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
  margin-bottom: 8rpx;
}

.risk-text {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.88);
  line-height: 34rpx;
}

.user-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20rpx;
  align-items: center;
}

.user-info.clickable {
  cursor: pointer;
}

.user-detail {
  flex: 1;
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.hero-illustration {
  width: 100%;
  height: 110rpx;
  margin-top: 10rpx;
}

.nickname,
.phone {
  color: #fff;
}

.phone {
  opacity: 0.82;
}

.hero-illustration {
  width: 100%;
  height: 160rpx;
  margin-top: 14rpx;
}

.earnings-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  padding: 18rpx 0 0;
  border-radius: 24rpx;
}

.earnings-item {
  background: rgba(255, 255, 255, 0.12);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 20rpx;
  padding: 16rpx 10rpx;
  backdrop-filter: blur(8px);
}

.earnings-value {
  font-size: 34rpx;
  margin-bottom: 6rpx;
  color: #fff;
}

.earnings-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.76);
}

.action-row {
  margin-top: 16rpx;
  display: flex;
  justify-content: center;
}

.btn-primary.outline {
  width: 100%;
  background: #fff;
  color: #2563eb;
  border-radius: 18rpx;
  box-shadow: none;
}

.btn-primary.outline.danger {
  color: #dc2626;
}

.section {
  margin-top: 16rpx;
}

.loading-panel {
  padding: 24rpx 0 8rpx;
  text-align: center;
  color: #64748b;
  font-size: 26rpx;
}

.section-header {
  padding: 0 20rpx;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.task-tabs {
  display: flex;
  gap: 12rpx;
  padding: 10rpx;
  background: rgba(255, 255, 255, 0.62);
  border-radius: 20rpx;
  margin-bottom: 20rpx;
}

.tab-item {
  flex: 1;
  justify-content: center;
  border-radius: 16rpx;
  padding: 18rpx 12rpx;
  background: transparent;
  text-align: center;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.tab-item.active {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(118, 75, 162, 0.9));
  color: #fff;
  box-shadow: 0 12rpx 24rpx rgba(102, 126, 234, 0.16);
}

.tab-count {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  background: #ff4d4f;
  color: #fff;
  border-radius: 999rpx;
  padding: 0 10rpx;
  font-size: 20rpx;
}

.submission-list {
  margin-top: 20rpx;
}

.submission-item {
  margin-bottom: 20rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.9);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20rpx;
}

.item-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  flex: 1;
}

.item-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.item-platform {
  font-size: 22rpx;
  color: #64748b;
}

.status-badge {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
}

.status-0 {
  background: #fef3c7;
  color: #92400e;
}

.status-1 {
  background: #dcfce7;
  color: #166534;
}

.status-2 {
  background: #fee2e2;
  color: #b91c1c;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.info-text {
  font-size: 26rpx;
  color: #475569;
}

.item-note {
  margin-top: 16rpx;
  padding: 16rpx;
  background: #f8fafc;
  border-radius: 16rpx;
  border: 1rpx solid #e2e8f0;
}

.note-label {
  font-size: 24rpx;
  color: #999;
  display: block;
  margin-bottom: 6rpx;
}

.note-text {
  font-size: 24rpx;
  color: #666;
  line-height: 36rpx;
}

.item-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.action-btn {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 16rpx;
  font-size: 26rpx;
  border: 1rpx solid #dcdfe6;
  background: #fff;
  color: #333;
}

.action-btn.primary {
  background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 12rpx 24rpx rgba(37, 99, 235, 0.2);
}

.action-btn.ghost {
  background: #fff;
  color: #333;
}

.empty {
  text-align: center;
  padding: 80rpx 0;
  color: #94a3b8;
  font-size: 26rpx;
}

.publish-empty {
  padding-top: 24rpx;
}

.empty-illustration {
  width: 260rpx;
  height: 160rpx;
  margin: 0 auto 18rpx;
}
</style>





