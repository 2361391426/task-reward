<template>
  <view class="container">
    <view v-if="loading" class="loading-panel">
      <text class="loading-text">正在加载个人中心...</text>
    </view>

    <view class="user-card card">
      <view class="user-info">
        <image class="avatar" :src="userInfo.avatar || '/static/images/default-avatar.png'" />
        <view class="user-detail">
          <text class="nickname">{{ userInfo.nickname || '未登录' }}</text>
          <text class="phone">{{ userInfo.phone || '未绑定手机号' }}</text>
        </view>
      </view>
      <image class="hero-illustration" src="/static/images/hero-wallet.png" mode="aspectFit" />

      <view v-if="Number(userInfo.risk_status) === 1" class="risk-banner">
        <text class="risk-title">当前账号已被标记，禁止接单</text>
        <text class="risk-text">{{ userInfo.risk_reason || '系统检测到异常身份关联，请联系后台处理。' }}</text>
      </view>

      <view class="earnings-info">
        <view class="earnings-item">
          <text class="earnings-value">¥{{ userInfo.total_earnings || 0 }}</text>
          <text class="earnings-label">累计收益</text>
        </view>
        <view class="earnings-item">
          <text class="earnings-value">¥{{ userInfo.available_balance || 0 }}</text>
          <text class="earnings-label">可提现余额</text>
        </view>
        <view class="earnings-item">
          <text class="earnings-value">¥{{ userInfo.frozen_balance || 0 }}</text>
          <text class="earnings-label">冻结中</text>
        </view>
      </view>

      <view class="action-row">
        <button class="btn-primary outline" @click="goWithdraw">去提现</button>
      </view>
    </view>

    <view v-if="loadError" class="error-panel">
      <text class="error-title">加载失败</text>
      <text class="error-text">{{ loadError }}</text>
      <button class="btn-secondary" @click="retryLoad">重试</button>
    </view>

    <view class="section" v-if="hasLoadedData">
      <view class="section-header">
        <text class="section-title">需要处理的任务</text>
      </view>

      <view class="submission-list">
        <view
          v-for="item in activeTasks"
          :key="item.id"
          class="submission-item card"
          @click="viewSubmission(item)"
        >
          <view class="item-header">
            <view class="item-title-wrap">
              <text class="item-title">{{ item.task_title }}</text>
              <text class="item-platform">{{ platformText(item.platform) }}</text>
            </view>
            <view class="status-badge" :class="'status-' + item.review_status">
              {{ getStatusText(item.review_status) }}
            </view>
          </view>

          <view class="item-info">
            <text class="info-text">提交时间: {{ formatTime(item.submit_time) }}</text>
            <text class="info-text">实付金额: ¥{{ item.paid_amount || 0 }}</text>
            <text class="info-text">返现金额: ¥{{ item.reward_amount }}</text>
          </view>

          <view class="item-note" v-if="item.review_note">
            <text class="note-label">审核提示:</text>
            <text class="note-text">{{ item.review_note }}</text>
          </view>

          <view class="item-actions" @click.stop>
            <button class="action-btn ghost" @click="viewSubmission(item)">查看详情</button>
            <button
              v-if="Number(item.review_status) === 2"
              class="action-btn primary"
              @click="resubmitSubmission(item)"
            >
              重新提交
            </button>
          </view>
        </view>
      </view>

      <view v-if="activeTasks.length === 0" class="empty">
        <image class="empty-illustration" src="/static/images/empty-task.png" mode="aspectFit" />
        <text>暂无需要处理的任务</text>
      </view>
    </view>

    <view class="section" v-if="hasLoadedData">
      <view class="section-header">
        <text class="section-title">我的任务</text>
      </view>

      <view class="task-tabs">
        <view
          v-for="(tab, index) in tabs"
          :key="index"
          class="tab-item"
          :class="{ active: currentTab === index }"
          @click="switchTab(index)"
        >
          <text>{{ tab.name }}</text>
          <text class="tab-count" v-if="tab.count > 0">{{ tab.count }}</text>
        </view>
      </view>

      <view class="submission-list">
        <view
          v-for="item in submissionList"
          :key="item.id"
          class="submission-item card"
          @click="viewSubmission(item)"
        >
          <view class="item-header">
            <view class="item-title-wrap">
              <text class="item-title">{{ item.task_title }}</text>
              <text class="item-platform">{{ platformText(item.platform) }}</text>
            </view>
            <view class="status-badge" :class="'status-' + item.review_status">
              {{ getStatusText(item.review_status) }}
            </view>
          </view>

          <view class="item-info">
            <text class="info-text">提交时间: {{ formatTime(item.submit_time) }}</text>
            <text class="info-text">实付金额: ¥{{ item.paid_amount || 0 }}</text>
            <text class="info-text">返现金额: ¥{{ item.reward_amount }}</text>
          </view>

          <view class="item-note" v-if="item.review_note">
            <text class="note-label">审核备注:</text>
            <text class="note-text">{{ item.review_note }}</text>
          </view>

          <view class="item-actions" @click.stop>
            <button class="action-btn ghost" @click="viewSubmission(item)">查看详情</button>
            <button
              v-if="Number(item.review_status) === 2"
              class="action-btn primary"
              @click="resubmitSubmission(item)"
            >
              重新提交
            </button>
          </view>
        </view>
      </view>

      <view v-if="submissionList.length === 0" class="empty">
        <image class="empty-illustration" src="/static/images/empty-submission.png" mode="aspectFit" />
        <text>暂无记录</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getMySubmissions } from '../../api/task.js'
import { getUserInfo, getEarnings } from '../../api/user.js'
import { formatTime, platformText, submissionStatusText } from '../../utils/format.js'

export default {
  data() {
    return {
      userInfo: {},
      loading: false,
      hasLoadedData: false,
      currentTab: 0,
      tabs: [
        { name: '全部', status: null, count: 0 },
        { name: '待审核', status: 0, count: 0 },
        { name: '已通过', status: 1, count: 0 },
        { name: '已驳回', status: 2, count: 0 }
      ],
      submissionList: [],
      allSubmissions: [],
      loadError: ''
    }
  },

  computed: {
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
    }
  },

  onShow() {
    this.refreshData(true)
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
      try {
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

        const [userInfoRes, earningsRes, submissionsRes] = await Promise.all([
          getUserInfo(),
          getEarnings(),
          Promise.resolve({ list: submissions })
        ])

        this.userInfo = {
          ...(userInfoRes || {}),
          total_earnings: earningsRes?.total_earnings || 0,
          available_balance: earningsRes?.available_balance || 0,
          frozen_balance: earningsRes?.frozen_balance || 0
        }
        this.allSubmissions = submissionsRes.list || []
        this.updateTabCounts()
        this.filterSubmissions()
        this.hasLoadedData = true
      } catch (error) {
        console.error('刷新我的页面失败', error)
        this.loadError = '我的页面加载失败，请重试'
      } finally {
        this.loading = false
      }
    },

    updateTabCounts() {
      this.tabs[0].count = this.allSubmissions.length
      this.tabs[1].count = this.allSubmissions.filter(item => Number(item.review_status) === 0).length
      this.tabs[2].count = this.allSubmissions.filter(item => Number(item.review_status) === 1).length
      this.tabs[3].count = this.allSubmissions.filter(item => Number(item.review_status) === 2).length
    },

    switchTab(index) {
      this.currentTab = index
      this.filterSubmissions()
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

    viewSubmission(item) {
      const submissionId = this.getSubmissionId(item)
      if (!submissionId) {
        uni.showToast({ title: '提交信息缺失', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/submission-detail/index?id=${submissionId}`
      })
    },

    resubmitSubmission(item) {
      const submissionId = this.getSubmissionId(item)
      if (!item || !item.task_id || !submissionId) {
        uni.showToast({ title: '提交信息缺失', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/upload/index?taskId=${item.task_id}&submissionId=${submissionId}`
      })
    },

    goWithdraw() {
      uni.navigateTo({
        url: '/pages/withdraw/index'
      })
    },

    retryLoad() {
      this.refreshData()
    }
  }
}
</script>

<style scoped>
.user-card {
  overflow: hidden;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.98), rgba(118, 75, 162, 0.92));
  color: #fff;
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
  align-items: center;
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
  padding: 24rpx;
  border-radius: 24rpx;
}

.earnings-item {
  background: rgba(255, 255, 255, 0.12);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 20rpx;
  padding: 18rpx 10rpx;
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
  margin-top: 20rpx;
  display: flex;
  justify-content: center;
}

.btn-primary.outline {
  width: 100%;
  background: #fff;
  color: #5b5bd6;
  border-radius: 18rpx;
  box-shadow: none;
}

.section {
  margin-top: 20rpx;
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
  background: #fff3cd;
  color: #856404;
}

.status-1 {
  background: #d4edda;
  color: #155724;
}

.status-2 {
  background: #f8d7da;
  color: #721c24;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 12rpx 24rpx rgba(102, 126, 234, 0.2);
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

.empty-illustration {
  width: 260rpx;
  height: 160rpx;
  margin: 0 auto 18rpx;
}
</style>
