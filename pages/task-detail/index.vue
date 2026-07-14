<template>
  <view class="container">
    <view class="detail-card card">
      <view class="header">
        <text class="title">{{ task.title || '任务详情' }}</text>
        <view class="reward">
          <text class="reward-label">任务奖励</text>
          <text class="reward-amount">¥{{ task.reward_amount || 0 }}</text>
        </view>
      </view>

      <view v-if="loading && !task.title && !loadError" class="loading-panel">
        <text class="loading-text">正在加载任务详情...</text>
      </view>

      <view v-if="loadError" class="error-panel">
        <text class="error-title">加载失败</text>
        <text class="error-text">{{ loadError }}</text>
        <button class="btn-secondary" @click="retryLoad">重试</button>
      </view>

      <view v-if="riskBlocked" class="risk-panel">
        <text class="risk-title">当前账号已被标记，禁止接单</text>
        <text class="risk-text">{{ riskReason || '系统检测到异常身份关联，请联系后台处理。' }}</text>
      </view>

      <view class="status-panel" v-if="submission">
        <text class="status-title">我的提交状态</text>
        <view class="status-row">
          <text class="status-label">状态</text>
          <text class="status-value" :class="'status-' + submission.review_status">
            {{ getStatusText(submission.review_status) }}
          </text>
        </view>
        <view class="status-row" v-if="submission.submit_time">
          <text class="status-label">提交时间</text>
          <text class="status-value">{{ formatTime(submission.submit_time) }}</text>
        </view>
        <view class="status-row" v-if="submission.review_note">
          <text class="status-label">审核备注</text>
          <text class="status-value">{{ submission.review_note }}</text>
        </view>
      </view>

      <view class="info-section">
        <view class="info-item">
          <text class="label">平台</text>
          <text class="value">{{ platformText(task.platform) }}</text>
        </view>
        <view class="info-item">
          <text class="label">搜索关键词</text>
          <text class="value">{{ task.search_keyword || '-' }}</text>
        </view>
        <view class="info-item">
          <text class="label">店铺名称</text>
          <text class="value">{{ task.shop_name || '-' }}</text>
        </view>
        <view class="info-item">
          <text class="label">商品名称</text>
          <text class="value">{{ task.product_name || '-' }}</text>
        </view>
        <view class="info-item">
          <text class="label">商品链接</text>
          <view class="value-with-action">
            <text class="value link-text">{{ task.product_link || '-' }}</text>
            <button
              v-if="task.product_link"
              class="copy-btn"
              size="mini"
              @click="copyProductLink"
            >
              复制
            </button>
          </view>
        </view>
        <view class="info-item">
          <text class="label">剩余名额</text>
          <text class="value">{{ remainingQuotaText }}</text>
        </view>
      </view>

      <view class="requirements">
        <text class="section-title">任务要求</text>
        <view class="req-list">
          <view class="req-item">
            <text class="req-num">1</text>
            <text class="req-text">按要求浏览商品并完成操作</text>
          </view>
          <view class="req-item">
            <text class="req-num">2</text>
            <text class="req-text">提交实付截图和相关步骤截图</text>
          </view>
          <view class="req-item">
            <text class="req-num">3</text>
            <text class="req-text">确保实付金额填写正确</text>
          </view>
        </view>
      </view>

      <view class="notice">
        <text class="notice-title">注意事项</text>
        <text class="notice-text">1. 提交后进入审核流程</text>
        <text class="notice-text">2. 请保留订单和实付款凭证</text>
        <text class="notice-text">3. 审核通过后按流程返还本金</text>
      </view>
    </view>

    <view class="footer">
      <button class="btn-primary" :disabled="actionDisabled || loading" @click="handlePrimaryAction">
        {{ primaryActionText }}
      </button>
    </view>
  </view>
</template>

<script>
import { getTaskDetail, getMySubmissions } from '../../api/task.js'
import { getUserInfo } from '../../api/user.js'
import { formatTime, platformText, submissionStatusText } from '../../utils/format.js'

export default {
  data() {
    return {
      taskId: '',
      task: {},
      submission: null,
      loading: false,
      submissionLoading: false,
      loadError: '',
      hasLoadedData: false,
      userInfo: {}
    }
  },

  computed: {
    remainingQuota() {
      const task = this.task || {}
      const remaining = task.remaining_quota
      if (remaining !== undefined && remaining !== null) {
        return Number(remaining) || 0
      }
      const total = Number(task.total_quota || 0)
      const used = Number(task.used_quota || 0)
      return Math.max(total - used, 0)
    },

    remainingQuotaText() {
      const task = this.task || {}
      if (task.total_quota === undefined && task.used_quota === undefined && task.remaining_quota === undefined) {
        return '-'
      }
      return `${this.remainingQuota}/${Number(task.total_quota || 0)}`
    },

    riskBlocked() {
      return Number(this.userInfo?.risk_status) === 1
    },

    riskReason() {
      return this.userInfo?.risk_reason || ''
    },

    actionDisabled() {
      return !this.taskId || this.loading || this.riskBlocked || (!this.submission && this.remainingQuota <= 0)
    },

    primaryActionText() {
      if (this.riskBlocked) return '当前禁止接单'
      if (!this.taskId) return '任务不存在'
      if (!this.submission) return this.remainingQuota <= 0 ? '已无名额' : '开始任务'
      const status = Number(this.submission.review_status)
      if (status === 2) return '重新提交'
      if (status === 0) return '查看提交'
      if (status === 1) return '查看结果'
      return '查看提交'
    }
  },

  onLoad(options) {
    this.taskId = options.id || options.taskId || ''
    if (!this.taskId) {
      uni.showToast({ title: '任务参数缺失', icon: 'none' })
      return
    }
    this.loadPageData(true)
  },

  onShow() {
    if (this.taskId && this.hasLoadedData) {
      this.loadPageData(true)
    }
  },

  async onPullDownRefresh() {
    try {
      await this.loadPageData(true)
    } finally {
      uni.stopPullDownRefresh()
    }
  },

  onShareAppMessage() {
    return {
      title: this.task.title ? `任务详情 - ${this.task.title}` : '任务详情',
      path: `/pages/task-detail/index?id=${this.taskId}`
    }
  },

  methods: {
    async loadPageData(forceRefresh = false) {
      this.loading = true
      this.loadError = ''
      try {
        await Promise.all([
          this.loadUserInfo(forceRefresh),
          this.loadTaskDetail(forceRefresh),
          this.loadCurrentSubmission(forceRefresh)
        ])
      } finally {
        this.loading = false
        this.hasLoadedData = true
      }
    },

    async loadUserInfo() {
      try {
        const res = await getUserInfo()
        this.userInfo = res || {}
        try {
          uni.setStorageSync('userInfo', this.userInfo)
        } catch (err) {}
      } catch (error) {
        console.error('加载用户信息失败', error)
      }
    },

    async loadTaskDetail() {
      try {
        const res = await getTaskDetail(this.taskId)
        this.task = res || {}
      } catch (error) {
        console.error('加载任务详情失败', error)
        this.loadError = '任务详情加载失败，请重试'
        uni.showToast({ title: '加载任务失败', icon: 'none' })
      }
    },

    async loadCurrentSubmission(forceRefresh = false) {
      this.submissionLoading = true
      try {
        let page = 1
        const pageSize = 50
        let found = null

        while (!found) {
          const res = await getMySubmissions(
            { page, page_size: pageSize },
            { forceRefresh: forceRefresh && page === 1 }
          )
          const list = Array.isArray(res && res.list) ? res.list : []
          found = list.find(item => String(item.task_id) === String(this.taskId)) || null
          const total = res && typeof res.total === 'number' ? res.total : list.length
          const returnedPageSize = res && typeof res.page_size === 'number' ? res.page_size : pageSize
          if (found || list.length < returnedPageSize || page * pageSize >= total) {
            break
          }
          page += 1
        }

        this.submission = found
      } catch (error) {
        console.error('加载提交记录失败', error)
        this.loadError = this.loadError || '提交记录加载失败，请重试'
      } finally {
        this.submissionLoading = false
      }
    },

    retryLoad() {
      this.task = {}
      this.submission = null
      this.loadPageData(true)
    },

    handlePrimaryAction() {
      if (this.riskBlocked) {
        uni.showToast({ title: this.riskReason || '当前账号已被标记，禁止接单', icon: 'none' })
        return
      }

      if (!this.submission && this.remainingQuota <= 0) {
        uni.showToast({ title: '当前任务已无名额', icon: 'none' })
        return
      }

      if (!this.submission) {
        this.startTask()
        return
      }

      const status = Number(this.submission.review_status)
      if (status === 2) {
        this.resubmitTask()
        return
      }

      this.viewSubmission()
    },

    startTask() {
      uni.navigateTo({
        url: `/pages/upload/index?taskId=${this.taskId}`
      })
    },

    resubmitTask() {
      uni.navigateTo({
        url: `/pages/upload/index?taskId=${this.taskId}&submissionId=${this.submission.id}`
      })
    },

    viewSubmission() {
      if (!this.submission) return
      uni.navigateTo({
        url: `/pages/submission-detail/index?id=${this.submission.id}`
      })
    },

    getStatusText(status) {
      return submissionStatusText(status)
    },

    formatTime(time) {
      return formatTime(time)
    },

    platformText(platform) {
      return platformText(platform)
    },

    copyProductLink() {
      if (!this.task.product_link) {
        uni.showToast({ title: '暂无商品链接', icon: 'none' })
        return
      }
      uni.setClipboardData({
        data: this.task.product_link,
        success: () => {
          uni.showToast({ title: '链接已复制', icon: 'none' })
        }
      })
    }
  }
}
</script>

<style scoped>
.container {
  padding-bottom: 120rpx;
}

.header {
  margin-bottom: 30rpx;
}

.title {
  font-size: 40rpx;
  line-height: 1.35;
  color: #111827;
  display: block;
  margin-bottom: 20rpx;
}

.reward {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 24rpx;
  border-radius: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 14rpx 28rpx rgba(102, 126, 234, 0.18);
}

.reward-label,
.reward-amount {
  color: #fff;
}

.reward-label {
  font-size: 28rpx;
}

.reward-amount {
  font-size: 52rpx;
  font-weight: bold;
}

.loading-panel {
  padding: 20rpx 0 10rpx;
  text-align: center;
}

.loading-text {
  font-size: 26rpx;
  color: #64748b;
}

.risk-panel {
  background: #fff1f2;
  border: 1rpx solid rgba(244, 63, 94, 0.16);
  border-radius: 20rpx;
  padding: 20rpx;
  margin-bottom: 24rpx;
}

.risk-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #be123c;
  display: block;
  margin-bottom: 10rpx;
}

.risk-text {
  font-size: 24rpx;
  color: #9f1239;
  line-height: 36rpx;
  display: block;
}

.status-panel {
  background: #eef2ff;
  border: 1rpx solid rgba(102, 126, 234, 0.18);
  border-radius: 20rpx;
  padding: 20rpx;
  margin-bottom: 24rpx;
}

.status-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #2d3a8c;
  display: block;
  margin-bottom: 12rpx;
}

.status-row {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 10rpx 0;
}

.status-label {
  font-size: 26rpx;
  color: #666;
}

.status-value {
  font-size: 26rpx;
  color: #333;
  text-align: right;
  flex: 1;
}

.status-value.status-0 {
  color: #ff9800;
}

.status-value.status-1 {
  color: #07c160;
}

.status-value.status-2 {
  color: #e64340;
}

.info-section {
  margin-bottom: 30rpx;
}

.info-item {
  display: flex;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.label {
  font-size: 28rpx;
  color: #64748b;
  width: 180rpx;
}

.value {
  font-size: 28rpx;
  color: #111827;
  flex: 1;
}

.value-with-action {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
}

.link-text {
  word-break: break-all;
}

.copy-btn {
  flex-shrink: 0;
  padding: 0 18rpx;
  line-height: 52rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 24rpx;
}

.requirements {
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #111827;
  display: block;
  margin-bottom: 20rpx;
}

.req-list {
  background: #f8fafc;
  padding: 24rpx;
  border-radius: 20rpx;
}

.req-item {
  display: flex;
  align-items: center;
  padding: 18rpx 0;
}

.req-num {
  width: 48rpx;
  height: 48rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  margin-right: 20rpx;
}

.req-text {
  font-size: 28rpx;
  color: #334155;
}

.notice {
  background: #fff7ed;
  padding: 20rpx;
  border-radius: 20rpx;
  border-left: 4rpx solid #f59e0b;
}

.notice-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #92400e;
  display: block;
  margin-bottom: 16rpx;
}

.notice-text {
  font-size: 26rpx;
  color: #92400e;
  display: block;
  line-height: 40rpx;
  margin-bottom: 8rpx;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx;
  background: linear-gradient(180deg, rgba(247, 248, 252, 0), #f7f8fc 35%, #f7f8fc 100%);
  box-shadow: none;
}

.footer .btn-primary {
  width: 100%;
  border-radius: 999rpx;
}
</style>
