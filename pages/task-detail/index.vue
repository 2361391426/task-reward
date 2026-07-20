<template>
  <view class="container">
    <view class="detail-card card">
      <view class="header">
        <text class="title">{{ task.title || '项目详情' }}</text>
        <view class="reward">
          <text class="reward-label">体验积分</text>
          <text class="reward-amount">{{ task.reward_amount || 0 }}积分</text>
        </view>
      </view>

      <view v-if="loading && !task.title && !loadError" class="loading-panel">
        <text class="loading-text">正在加载项目详情...</text>
      </view>

      <view v-if="loadError" class="error-panel">
        <text class="error-title">加载失败</text>
        <text class="error-text">{{ loadError }}</text>
        <button class="btn-secondary" @click="retryLoad">重试</button>
      </view>

      <view v-if="riskBlocked" class="risk-panel">
        <text class="risk-title">当前账号已被标记，暂不可参与</text>
        <text class="risk-text">{{ riskReason || '系统检测到异常身份关联，请联系后台处理。' }}</text>
      </view>

      <view v-if="publishBlocked" class="risk-panel">
        <text class="risk-title">当前账号为发布账号，仅可查看详情</text>
        <text class="risk-text">发布账号不能参与项目列表，如需查看状态请到“我的发布”。</text>
      </view>

      <view v-if="acceptNotStarted" class="notice-panel">
        <text class="notice-title">项目已发布，待开放参与</text>
        <text class="notice-text">可参与时间：{{ acceptStartTimeText }}</text>
      </view>

      <view v-if="taskClaimReminderVisible" class="deadline-panel">
        <text class="deadline-title">参与后请在 1 小时内提交凭证</text>
        <text class="deadline-text">剩余时间：{{ taskClaimCountdownText }}，超时后名额将自动释放，今日无法再次参与。</text>
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
        <view class="info-item">
          <text class="label">可参与时间</text>
          <text class="value">{{ acceptStartTimeText }}</text>
        </view>
      </view>

      <view class="requirements">
        <text class="section-title">体验要求</text>
        <view class="req-list">
          <view class="req-item">
            <text class="req-num">1</text>
            <text class="req-text">按要求完成页面体验并保留必要凭证</text>
          </view>
          <view class="req-item">
            <text class="req-num">2</text>
            <text class="req-text">提交体验过程截图和必要说明</text>
          </view>
          <view class="req-item">
            <text class="req-num">3</text>
            <text class="req-text">确保填写信息真实有效</text>
          </view>
        </view>
      </view>

      <view class="notice">
        <text class="notice-title">注意事项</text>
        <text class="notice-text">1. 提交后进入审核流程</text>
        <text class="notice-text">2. 请保留体验过程凭证</text>
        <text class="notice-text">3. 审核通过后按规则进入积分兑换</text>
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
import { claimTask, getTaskDetail, getMySubmissions } from '../../api/task.js'
import { getUserInfo } from '../../api/user.js'
import { formatTime, platformText, submissionStatusText } from '../../utils/format.js'
import { hasStartedTaskDraft, saveStartedTaskDraft } from '../../utils/started-task-draft.js'
import { requestTaskSubscribeMessage } from '../../utils/subscribe.js'

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
      userInfo: {},
      nowTs: Date.now(),
      countdownTimer: null
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

    acceptStartTimeText() {
      return this.task?.accept_start_time || this.task?.start_time || '立即可参与'
    },

    acceptNotStarted() {
      if (!this.taskId || this.riskBlocked || this.submission) {
        return false
      }
      const startTime = this.task?.accept_start_time_raw || this.task?.accept_start_time || this.task?.start_time_raw || this.task?.start_time
      if (!startTime) {
        return false
      }
      return new Date(startTime).getTime() > Date.now()
    },

    riskBlocked() {
      return Number(this.userInfo?.risk_status) === 1
    },

    publishBlocked() {
      return Number(this.userInfo?.publish_permission || 0) === 1
    },

    riskReason() {
      return this.userInfo?.risk_reason || ''
    },

    submissionDraftExpiresAt() {
      if (!this.submission) return ''
      if (Number(this.submission.review_status) !== -1) return ''
      return this.submission.expires_at || this.task?.claim_expires_at || ''
    },

    taskClaimReminderVisible() {
      return Boolean(this.submissionDraftExpiresAt)
    },

    taskClaimCountdownText() {
      return this.formatCountdown(this.submissionDraftExpiresAt)
    },

    startedTaskDraftExists() {
      return hasStartedTaskDraft(this.taskId)
    },

    isLoggedIn() {
      try {
        return Boolean(uni.getStorageSync('token'))
      } catch (error) {
        return false
      }
    },

    actionDisabled() {
      return !this.taskId || this.loading || !this.isLoggedIn || this.riskBlocked || this.publishBlocked || (!this.submission && (this.remainingQuota <= 0 || this.acceptNotStarted))
    },

    primaryActionText() {
      if (!this.isLoggedIn) return '去登录'
      if (this.riskBlocked) return '暂不可参与'
      if (this.publishBlocked) return '仅查看详情'
      if (!this.taskId) return '项目不存在'
      if (!this.submission) {
        if (this.startedTaskDraftExists) return '继续体验'
        if (this.acceptNotStarted) return '待开放'
        return this.remainingQuota <= 0 ? '已无名额' : '参与体验'
      }
      const status = Number(this.submission.review_status)
      if (status === -1) return '继续体验'
      if (status === 2) return '重新提交'
      if (status === 0) return '查看提交'
      if (status === 1) return '查看结果'
      return '查看提交'
    }
  },

  onLoad(options) {
    this.taskId = options.id || options.taskId || ''
    if (!this.taskId) {
      uni.showToast({ title: '项目参数缺失', icon: 'none' })
      return
    }
    this.loadPageData(true)
  },

  onShow() {
    this.startCountdownTimer()
    if (this.taskId && this.hasLoadedData) {
      this.loadPageData(true)
    }
  },

  onHide() {
    this.stopCountdownTimer()
  },

  onUnload() {
    this.stopCountdownTimer()
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
      title: this.task.title ? `项目详情 - ${this.task.title}` : '项目详情',
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
        console.error('加载项目详情失败', error)
        this.loadError = '项目详情加载失败，请重试'
        uni.showToast({ title: '加载项目失败', icon: 'none' })
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
      if (!this.isLoggedIn) {
        uni.showToast({ title: '请先登录后再参与', icon: 'none' })
        uni.switchTab({ url: '/pages/my/index' })
        return
      }

      if (this.riskBlocked) {
        uni.showToast({ title: this.riskReason || '当前账号已被标记，暂不可参与', icon: 'none' })
        return
      }

      if (this.publishBlocked) {
        uni.showToast({ title: '发布账号仅可查看项目详情', icon: 'none' })
        return
      }

      if (!this.submission && this.remainingQuota <= 0) {
        uni.showToast({ title: '当前项目已无名额', icon: 'none' })
        return
      }

      if (!this.submission && this.acceptNotStarted) {
        uni.showToast({ title: '当前项目暂未到可参与时间', icon: 'none' })
        return
      }

      if (!this.submission) {
        if (this.startedTaskDraftExists) {
          this.continueTask()
          return
        }
        this.startTask()
        return
      }

      const status = Number(this.submission.review_status)
      if (status === -1) {
        this.continueTask()
        return
      }
      if (status === 2) {
        this.resubmitTask()
        return
      }

      this.viewSubmission()
    },

    startTask() {
      requestTaskSubscribeMessage()
      claimTask(this.taskId)
        .then((res) => {
          const submissionId = res?.submission_id || res?.data?.submission_id
          const expiresAt = res?.expires_at || res?.data?.expires_at || ''
          saveStartedTaskDraft({
            id: submissionId || this.taskId,
            task_id: this.taskId,
            title: this.task.title,
            task_title: this.task.title,
            platform: this.task.platform,
            reward_amount: this.task.reward_amount,
            total_quota: this.task.total_quota,
            used_quota: this.task.used_quota,
            remaining_quota: this.remainingQuota,
            accept_start_time: this.task.accept_start_time,
            start_time: this.task.start_time,
            end_time: this.task.end_time,
            created_at: this.task.created_at,
            expires_at: expiresAt
          })
          uni.navigateTo({
            url: submissionId
              ? `/pages/upload/index?taskId=${this.taskId}&submissionId=${submissionId}`
              : `/pages/upload/index?taskId=${this.taskId}`
          })
        })
        .catch((error) => {
          uni.showToast({ title: error?.message || '项目暂时无法参与', icon: 'none' })
        })
    },

    continueTask() {
      requestTaskSubscribeMessage()
      uni.navigateTo({
        url: this.submission && Number(this.submission.review_status) === -1
          ? `/pages/upload/index?taskId=${this.taskId}&submissionId=${this.submission.id}`
          : `/pages/upload/index?taskId=${this.taskId}`
      })
    },

    resubmitTask() {
      requestTaskSubscribeMessage()
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

    formatCountdown(targetTime) {
      if (!targetTime) return '已过期'
      const target = new Date(targetTime).getTime()
      if (Number.isNaN(target)) return '已过期'
      const diff = target - this.nowTs
      if (diff <= 0) return '已过期'
      const totalMinutes = Math.ceil(diff / 60000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      if (hours > 0) {
        return `${hours}小时${minutes}分钟`
      }
      return `${minutes}分钟`
    },

    startCountdownTimer() {
      if (this.countdownTimer) return
      this.nowTs = Date.now()
      this.countdownTimer = setInterval(() => {
        this.nowTs = Date.now()
      }, 30000)
    },

    stopCountdownTimer() {
      if (!this.countdownTimer) return
      clearInterval(this.countdownTimer)
      this.countdownTimer = null
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

.notice-panel {
  background: #eff6ff;
  border: 1rpx solid rgba(59, 130, 246, 0.18);
  border-radius: 20rpx;
  padding: 20rpx;
  margin-bottom: 24rpx;
}

.notice-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1d4ed8;
  display: block;
  margin-bottom: 10rpx;
}

.notice-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #334155;
  display: block;
}

.deadline-panel {
  background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
  border: 1rpx solid rgba(244, 63, 94, 0.22);
  border-radius: 20rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 12rpx 28rpx rgba(244, 63, 94, 0.12);
}

.deadline-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #be123c;
  display: block;
  margin-bottom: 8rpx;
}

.deadline-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #9f1239;
  display: block;
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
