<template>
  <view class="container">
    <view v-if="loadError" class="error-panel">
      <text class="error-title">加载失败</text>
      <text class="error-text">{{ loadError }}</text>
      <button class="btn-secondary" @click="retryLoad">重试</button>
    </view>

    <template v-if="!loadError || hasFallbackData">
      <view class="info-card card">
        <view class="info-header">
          <view class="title-group">
            <text class="info-title">{{ submission.task_title || '提交详情' }}</text>
            <text class="subtitle">提交编号：{{ submission.id || submissionId || '-' }}</text>
          </view>
          <view class="status-badge" :class="'status-' + Number(submission.review_status || 0)">
            {{ getStatusText(submission.review_status) }}
          </view>
        </view>

        <view class="info-item">
          <text class="label">平台</text>
          <text class="value">{{ platformText(submission.platform) }}</text>
        </view>
        <view class="info-item">
          <text class="label">实付金额</text>
          <text class="value">¥{{ submission.paid_amount || 0 }}</text>
        </view>
        <view class="info-item">
          <text class="label">返现金额</text>
          <text class="value">¥{{ submission.reward_amount || 0 }}</text>
        </view>
        <view class="info-item">
          <text class="label">提交时间</text>
          <text class="value">{{ formatTime(submission.submit_time) }}</text>
        </view>
        <view class="info-item" v-if="submission.review_time">
          <text class="label">审核时间</text>
          <text class="value">{{ formatTime(submission.review_time) }}</text>
        </view>
        <view class="info-item" v-if="submission.review_note">
          <text class="label">审核备注</text>
          <text class="value error">{{ submission.review_note }}</text>
        </view>
      </view>

      <view class="screenshots-card card">
        <text class="section-title">提交截图</text>

        <view class="screenshot-section" v-for="(section, index) in screenshotSections" :key="index">
          <text class="screenshot-label">{{ section.label }}</text>
          <view class="screenshot-list" v-if="section.images.length">
            <image
              v-for="(img, imgIndex) in section.images"
              :key="imgIndex"
              :src="img"
              mode="aspectFill"
              class="screenshot-image"
              @click="previewImage(img, section.images)"
            />
          </view>
          <view class="screenshot-empty" v-else>
            <text>暂无截图</text>
          </view>
        </view>
      </view>

      <view class="footer" v-if="Number(submission.review_status) === 2 || Number(submission.review_status) === -1">
        <button class="btn-primary" @click="resubmit">
          {{ Number(submission.review_status) === -1 ? '编辑订单' : '重新提交' }}
        </button>
      </view>
    </template>
  </view>
</template>

<script>
import { getSubmissionDetail } from '../../api/task.js'
import { formatTime, platformText, submissionStatusText } from '../../utils/format.js'
import { buildSubmissionScreenshotSections } from '../../utils/task-submission-steps.js'

export default {
  data() {
    return {
      submissionId: '',
      submission: {},
      screenshotSections: [],
      loadError: '',
      hasFallbackData: false
    }
  },

  onLoad(options) {
    this.submissionId = options.id || options.submissionId || options.submission_id || ''
    if (!this.submissionId) {
      uni.showToast({ title: '提交参数缺失', icon: 'none' })
      return
    }
    this.restoreCachedDetail()
    if (import.meta.env.DEV) {
      this.applyMockDetail()
      return
    }
    this.loadDetail()
  },

  async onPullDownRefresh() {
    try {
      await this.loadDetail()
    } finally {
      uni.stopPullDownRefresh()
    }
  },

  methods: {
    getCacheKey() {
      return `task-reward:submission-detail:${this.submissionId || 'unknown'}`
    },

    restoreCachedDetail() {
      try {
        const raw = uni.getStorageSync(this.getCacheKey())
        if (!raw) return false
        const cached = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (!cached || typeof cached !== 'object') return false
        this.submission = cached
        this.parseScreenshots()
        this.hasFallbackData = true
        return true
      } catch (error) {
        console.error('恢复提交详情缓存失败', error)
        return false
      }
    },

    saveCachedDetail() {
      try {
        uni.setStorageSync(this.getCacheKey(), JSON.stringify(this.submission || {}))
      } catch (error) {}
    },

    async loadDetail() {
      try {
        this.loadError = ''
        uni.showLoading({ title: '加载中...' })
        const res = await getSubmissionDetail(this.submissionId)
        this.submission = res || {}
        this.parseScreenshots()
        this.saveCachedDetail()
        this.hasFallbackData = true
      } catch (error) {
        console.error('加载详情失败', error)
        this.hasFallbackData = !!this.submission && Object.keys(this.submission).length > 0
        if (!this.hasFallbackData) {
          this.loadError = '提交详情加载失败，请重试'
          uni.showToast({ title: '加载失败', icon: 'none' })
        } else {
          this.loadError = ''
          uni.showToast({ title: '详情加载失败，已显示缓存', icon: 'none' })
        }
      } finally {
        uni.hideLoading()
      }
    },

    parseScreenshots() {
      this.screenshotSections = buildSubmissionScreenshotSections(this.submission, this.submission.platform)
    },

    previewImage(current, urls) {
      uni.previewImage({
        current,
        urls
      })
    },

    resubmit() {
      if (!this.submission.task_id) {
        uni.showToast({ title: '任务信息缺失，无法重新提交', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/upload/index?taskId=${this.submission.task_id}&submissionId=${this.submissionId}`
      })
    },

    retryLoad() {
      this.submission = {}
      this.screenshotSections = []
      this.hasFallbackData = false
      this.loadDetail()
    },

    getStatusText(status) {
      return submissionStatusText(status)
    },

    platformText(platform) {
      return platformText(platform)
    },

    formatTime(time) {
      return formatTime(time)
    }
  }
}
</script>

<style scoped>
.container {
  padding-bottom: 120rpx;
}

.info-card,
.screenshots-card,
.error-panel {
  margin-bottom: 20rpx;
}

.info-card,
.screenshots-card {
  overflow: hidden;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20rpx;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.title-group {
  flex: 1;
}

.info-title {
  font-size: 38rpx;
  line-height: 1.35;
  color: #111827;
  display: block;
}

.subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #94a3b8;
  display: block;
}

.status-badge {
  padding: 10rpx 18rpx;
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

.info-item {
  display: flex;
  padding: 18rpx 0;
}

.label {
  width: 180rpx;
  font-size: 28rpx;
  color: #64748b;
}

.value {
  flex: 1;
  font-size: 28rpx;
  color: #111827;
}

.value.error {
  color: #ff4444;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
  display: block;
  margin-bottom: 20rpx;
}

.screenshot-section {
  margin-bottom: 30rpx;
}

.screenshot-label {
  font-size: 28rpx;
  color: #334155;
  display: block;
  margin-bottom: 16rpx;
  font-weight: 600;
}

.screenshot-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.screenshot-empty {
  font-size: 26rpx;
  color: #94a3b8;
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 24rpx;
  border: 1rpx dashed #cbd5e1;
}

.screenshot-image {
  width: 210rpx;
  height: 210rpx;
  border-radius: 12rpx;
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.1);
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 20rpx calc(20rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(247, 248, 252, 0), #f7f8fc 35%, #f7f8fc 100%);
}

.footer .btn-primary {
  width: 100%;
  border-radius: 999rpx;
}
</style>
