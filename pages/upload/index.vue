<template>
  <view class="container">
    <view class="hero card">
      <view class="hero-copy">
        <text class="eyebrow">提交审核</text>
        <text class="hero-title">按步骤补齐凭证并提交</text>
        <text class="hero-desc">草稿会自动保存，重新进入页面时会回显上次填写内容。</text>
      </view>
      <image class="hero-image" src="/static/images/empty-upload.png" mode="aspectFit" />
    </view>

    <view v-if="riskBlocked" class="risk-banner card">
      <text class="risk-title">当前账号已被标记，暂不可参与</text>
      <text class="risk-desc">{{ riskReason || '系统检测到异常身份关联，请联系后台处理。' }}</text>
    </view>

    <view v-if="claimReminderVisible" class="deadline-banner card">
      <text class="deadline-title">请在 1 小时内提交凭证</text>
      <text class="deadline-desc">剩余时间：{{ claimCountdownText }}，超时后名额将自动释放，今日无法再次参与。</text>
    </view>

    <view class="draft card">
      <view class="draft-row">
        <text class="draft-label">当前进度</text>
        <text class="draft-value">{{ completedSteps }}/{{ totalSteps }} 步</text>
      </view>
      <view class="draft-row">
        <text class="draft-label">草稿状态</text>
        <text class="draft-value">已自动保存</text>
      </view>
    </view>

    <view class="steps">
      <view v-for="(step, index) in uploadSteps" :key="step.id" class="step card">
        <view class="step-head">
          <view class="step-head-main">
            <text class="step-title">{{ step.name }}</text>
            <text class="step-sub">请按要求上传对应凭证</text>
          </view>
          <view class="step-head-side">
            <text class="step-count">{{ step.images.length }}/{{ step.count }}</text>
            <text v-if="getStepHint(step)" class="step-hint">{{ getStepHint(step) }}</text>
          </view>
        </view>

        <view class="image-list">
          <view v-for="(img, imgIndex) in step.images" :key="imgIndex" class="image-item">
            <image :src="img" mode="aspectFill" class="preview-image" />
            <view class="delete-btn" @click="deleteImage(index, imgIndex)">
              <text>×</text>
            </view>
          </view>

          <view
            v-if="step.images.length < step.count"
            class="upload-btn"
            @click="chooseImage(index)"
          >
            <text class="upload-icon">+</text>
            <text class="upload-text">上传</text>
          </view>
        </view>
      </view>
    </view>

    <view class="form card">
      <text class="section-title">联系信息</text>
      <input
        class="input"
        type="text"
        placeholder="请输入微信号，支持复制粘贴"
        v-model="wechatId"
      />
      <input
        class="input"
        type="text"
        placeholder="请输入手机号，支持复制粘贴"
        v-model="phoneNumber"
      />
      <input
        class="input"
        type="text"
        placeholder="请输入活动记录号，支持复制粘贴"
        v-model="orderNumber"
      />
    </view>

    <view class="footer">
      <button class="btn-primary" @click="submitTask" :disabled="submitting" :loading="submitting">
        {{ submitting ? '提交中...' : (submissionId ? '重新提交审核' : '提交审核') }}
      </button>
    </view>
  </view>
</template>

<script>
import { chooseAndUploadImage } from '../../utils/upload.js'
import { submitTask, resubmitTask, getSubmissionDetail, getTaskDetail, invalidateTaskCache } from '../../api/task.js'
import { createDraftScheduler } from '../../utils/draft.js'
import { clearStartedTaskDraft } from '../../utils/started-task-draft.js'
import { createEmptyUploadSteps, hydrateUploadSteps, normalizePlatform } from '../../utils/task-submission-steps.js'

export default {
  data() {
    return {
      taskId: '',
      submissionId: '',
      taskPlatform: '',
      wechatId: '',
      phoneNumber: '',
      orderNumber: '',
      paidAmount: '0',
      submitting: false,
      uploadSteps: [],
      submissionDetail: null,
      submissionCompleted: false,
      nowTs: Date.now(),
      countdownTimer: null
    }
  },

  created() {
    this.draftScheduler = createDraftScheduler(() => this.saveDraft(), 400)
  },

  computed: {
    userRisk() {
      try {
        const userInfo = uni.getStorageSync('userInfo')
        if (!userInfo) return {}
        return typeof userInfo === 'string' ? JSON.parse(userInfo) : userInfo
      } catch (error) {
        return {}
      }
    },

    riskBlocked() {
      return Number(this.userRisk.risk_status) === 1
    },

    riskReason() {
      return this.userRisk.risk_reason || ''
    },

    claimExpiresAt() {
      if (this.submissionCompleted) {
        return ''
      }

      const submissionStatus = Number(this.submissionDetail?.review_status ?? this.submissionDetail?.status ?? 0)
      if (this.submissionId && submissionStatus !== -1) {
        return ''
      }

      return this.submissionDetail?.expires_at || this.loadDraftExpiresAt() || ''
    },

    claimReminderVisible() {
      return Boolean(this.claimExpiresAt) && !this.submissionCompleted
    },

    claimCountdownText() {
      return this.formatCountdown(this.claimExpiresAt)
    },

    draftKey() {
      let userId = 'guest'
      try {
        const userInfo = uni.getStorageSync('userInfo')
        if (userInfo) {
          const parsed = typeof userInfo === 'string' ? JSON.parse(userInfo) : userInfo
          userId = parsed?.id ? String(parsed.id) : userId
        }
      } catch (error) {
        console.error('解析用户草稿范围失败', error)
      }
      return `task-reward:upload-draft:${userId}:${this.taskId || 'unknown'}:${this.submissionId || 'new'}`
    },

    totalSteps() {
      return this.uploadSteps.length
    },

    completedSteps() {
      return this.uploadSteps.filter(step => step.images.length === step.count).length
    },

    canSubmit() {
      const allImagesUploaded = this.uploadSteps.every(step => step.images.length === step.count)
      const wechatValid = String(this.wechatId || '').trim().length > 0
      const phoneValid = /^1[3-9]\d{9}$/.test(String(this.phoneNumber || '').trim())
      const orderValid = String(this.orderNumber || '').trim().length > 0
      return allImagesUploaded && wechatValid && phoneValid && orderValid && !this.riskBlocked
    },

    validationMessage() {
      if (this.riskBlocked) {
        return this.riskReason || '当前账号已被标记，暂不可参与'
      }

      const missingStep = this.uploadSteps.find(step => step.images.length < step.count)
      if (missingStep) {
        const remain = missingStep.count - missingStep.images.length
        return `${missingStep.name}还差${remain}张凭证`
      }

      if (!String(this.wechatId || '').trim()) {
        return '请填写微信号'
      }

      if (!/^1[3-9]\d{9}$/.test(String(this.phoneNumber || '').trim())) {
        return '请填写正确的手机号'
      }

      if (!String(this.orderNumber || '').trim()) {
        return '请填写活动记录号'
      }

      return ''
    },

    firstMissingStepHint() {
      const missingStep = this.uploadSteps.find(step => step.images.length < step.count)
      if (!missingStep) return ''
      return this.getStepHint(missingStep)
    }
  },

  watch: {
    phoneNumber() {
      this.scheduleSaveDraft()
    },

    wechatId() {
      this.scheduleSaveDraft()
    },

    orderNumber() {
      this.scheduleSaveDraft()
    },

    paidAmount() {
      this.scheduleSaveDraft()
    },

    uploadSteps: {
      deep: true,
      handler() {
        this.scheduleSaveDraft()
      }
    }
  },

  onLoad(options) {
    this.taskId = options.taskId || ''
    this.submissionId = options.submissionId || ''
    this.bootstrapPage()
  },
  onShow() {
    this.startCountdownTimer()
  },
  onHide() {
    this.flushDraftSave()
    this.stopCountdownTimer()
  },

  onUnload() {
    this.flushDraftSave()
    this.stopCountdownTimer()
  },

  async onPullDownRefresh() {
    try {
      if (this.submissionId) {
        await this.loadSubmissionData()
      } else {
        this.loadDraft()
      }
    } finally {
      uni.stopPullDownRefresh()
    }
  },

  methods: {
    async bootstrapPage() {
      try {
        const token = uni.getStorageSync('token')
        if (!token) {
          uni.showToast({ title: '请先登录后再参与', icon: 'none' })
          uni.switchTab({ url: '/pages/my/index' })
          return
        }
      } catch (error) {}

      await this.loadTaskContext()

      if (this.loadDraft()) {
        return
      }

      this.fillPhoneFromCache()

      if (this.submissionId) {
        await this.loadSubmissionData()
      }
    },

    async loadTaskContext() {
      try {
        if (this.submissionId) {
          const submission = await getSubmissionDetail(this.submissionId)
          this.submissionDetail = submission || null
          this.taskPlatform = normalizePlatform(submission?.platform || this.taskPlatform)
          this.resetUploadSteps()
          return
        }

        if (this.taskId) {
          const task = await getTaskDetail(this.taskId)
          this.taskPlatform = normalizePlatform(task?.platform || this.taskPlatform)
          this.resetUploadSteps()
          return
        }
      } catch (error) {
        console.error('加载项目上下文失败', error)
      }

      this.taskPlatform = normalizePlatform(this.taskPlatform)
      this.resetUploadSteps()
    },

    loadDraftExpiresAt() {
      try {
        const raw = uni.getStorageSync(this.draftKey)
        if (!raw) return ''
        const draft = typeof raw === 'string' ? JSON.parse(raw) : raw
        return draft?.expires_at || ''
      } catch (error) {
        return ''
      }
    },

    resetUploadSteps(draftSteps = []) {
      this.uploadSteps = draftSteps.length
        ? hydrateUploadSteps(this.taskPlatform, draftSteps)
        : createEmptyUploadSteps(this.taskPlatform)
    },

    buildDraftPayload() {
      return {
        taskId: this.taskId,
        submissionId: this.submissionId,
        taskPlatform: this.taskPlatform,
        wechatId: this.wechatId,
        phoneNumber: this.phoneNumber,
        orderNumber: this.orderNumber,
        paidAmount: this.paidAmount,
        uploadSteps: this.uploadSteps.map(step => ({
          id: step.id,
          key: step.key,
          name: step.name,
          count: step.count,
          fieldNames: Array.isArray(step.fieldNames) ? [...step.fieldNames] : [],
          images: [...step.images]
        }))
      }
    },

    applyDraft(draft) {
      if (!draft || !Array.isArray(draft.uploadSteps)) return false

      if (draft.taskPlatform) {
        this.taskPlatform = normalizePlatform(draft.taskPlatform)
      }
      this.wechatId = draft.wechatId || ''
      this.phoneNumber = draft.phoneNumber || ''
      this.orderNumber = draft.orderNumber || ''
      this.paidAmount = draft.paidAmount || '0'
      this.resetUploadSteps(draft.uploadSteps)
      return true
    },

    fillPhoneFromCache() {
      try {
        const cachedPhone = uni.getStorageSync('task-reward:phone-number')
        if (cachedPhone && !this.phoneNumber) {
          this.phoneNumber = String(cachedPhone)
        }
      } catch (error) {}
    },

    loadDraft() {
      try {
        const raw = uni.getStorageSync(this.draftKey)
        if (!raw) return false
        const draft = typeof raw === 'string' ? JSON.parse(raw) : raw
        return this.applyDraft(draft)
      } catch (error) {
        console.error('加载草稿失败', error)
        return false
      }
    },

    saveDraft() {
      try {
        uni.setStorageSync(this.draftKey, JSON.stringify(this.buildDraftPayload()))
      } catch (error) {
        console.error('保存草稿失败', error)
      }
    },

    scheduleSaveDraft() {
      this.draftScheduler?.schedule()
    },

    flushDraftSave() {
      this.draftScheduler?.flush()
    },

    clearDraft() {
      try {
        uni.removeStorageSync(this.draftKey)
      } catch (error) {
        console.error('清理草稿失败', error)
      }
    },

    async loadSubmissionData() {
      try {
        uni.showLoading({ title: '加载中...' })
        const res = await getSubmissionDetail(this.submissionId)
        this.taskPlatform = normalizePlatform(res.platform || this.taskPlatform)
        this.resetUploadSteps()
        this.uploadSteps = this.uploadSteps.map((step) => ({
          ...step,
          images: (step.fieldNames || []).map((fieldName) => res[fieldName]).filter(Boolean).slice(0, step.count)
        }))
        this.wechatId = res.wechat_id || ''
        this.phoneNumber = res.phone_number || ''
        this.orderNumber = res.order_number || ''
        this.paidAmount = res.paid_amount ? String(res.paid_amount) : '0'
        this.saveDraft()
      } catch (error) {
        console.error('加载提交数据失败', error)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        uni.hideLoading()
      }
    },

    async chooseImage(stepIndex) {
      const step = this.uploadSteps[stepIndex]
      const remainCount = step.count - step.images.length

      try {
        const urls = await chooseAndUploadImage(remainCount)
        step.images.push(...urls)
        this.saveDraft()
        uni.showToast({
          title: '上传成功',
          icon: 'success'
        })
      } catch (error) {
        console.error('上传失败', error)
      }
    },

    deleteImage(stepIndex, imgIndex) {
      uni.showModal({
        title: '提示',
        content: '确定删除这张图片吗？',
        success: (res) => {
          if (res.confirm) {
            this.uploadSteps[stepIndex].images.splice(imgIndex, 1)
            this.saveDraft()
          }
        }
      })
    },

    async submitTask() {
      if (this.riskBlocked) {
        uni.showToast({
          title: this.riskReason || '当前账号已被标记，暂不可参与',
          icon: 'none'
        })
        return
      }

      if (!this.canSubmit) {
        uni.showToast({
          title: this.validationMessage || '请完善所有信息',
          icon: 'none'
        })
        return
      }

      try {
        this.submitting = true
        uni.showLoading({ title: '提交中...' })

        const data = {
          task_id: this.taskId,
          wechat_id: this.wechatId,
          phone_number: this.phoneNumber,
          order_number: this.orderNumber,
          paid_amount: 0
        }

        this.uploadSteps.forEach((step) => {
          (step.fieldNames || []).forEach((fieldName, index) => {
            data[fieldName] = step.images[index] || ''
          })
        })

        if (this.submissionId) {
          await resubmitTask(this.submissionId, data)
        } else {
          const res = await submitTask(data)
          if (res?.submission_id) {
            this.submissionId = String(res.submission_id)
          }
        }

        invalidateTaskCache()
        this.clearDraft()
        clearStartedTaskDraft(this.taskId)
        this.submissionCompleted = true
        this.submissionDetail = null
        this.stopCountdownTimer()
        uni.showToast({
          title: '提交成功',
          icon: 'success'
        })

        setTimeout(() => {
          if (this.submissionId) {
            uni.redirectTo({
              url: `/pages/submission-detail/index?id=${this.submissionId}`
            })
            return
          }
          uni.navigateBack()
        }, 1500)
      } catch (error) {
        console.error('提交失败', error)
        uni.showToast({
          title: error?.message || '提交失败，请重试',
          icon: 'none'
        })
      } finally {
        this.submitting = false
        uni.hideLoading()
      }
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
      this.nowTs = Date.now()
    },

    getStepHint(step) {
      if (!step || !Array.isArray(step.images)) return ''
      const remain = Math.max(Number(step.count || 0) - step.images.length, 0)
      if (remain <= 0) return ''
      return `还差${remain}张`
    }
  }
}
</script>

<style scoped>
.container {
  padding: 24rpx 24rpx 140rpx;
  background: linear-gradient(180deg, #f6f8ff 0%, #f7f8fc 40%, #f7f8fc 100%);
  min-height: 100vh;
}

.card {
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 14rpx 40rpx rgba(15, 23, 42, 0.08);
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  flex: 1;
}

.eyebrow {
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.hero-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #0f172a;
}

.hero-desc {
  color: #64748b;
  font-size: 24rpx;
  line-height: 34rpx;
}

.hero-image {
  width: 168rpx;
  height: 126rpx;
  flex-shrink: 0;
}

.risk-banner {
  background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
  border: 1rpx solid rgba(244, 63, 94, 0.16);
  padding: 22rpx 24rpx;
  margin-bottom: 20rpx;
}

.risk-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #be123c;
  margin-bottom: 8rpx;
}

.risk-desc {
  display: block;
  font-size: 24rpx;
  color: #9f1239;
  line-height: 34rpx;
}

.deadline-banner {
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  border: 1rpx solid rgba(249, 115, 22, 0.22);
  padding: 22rpx 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 12rpx 28rpx rgba(249, 115, 22, 0.12);
}

.deadline-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #c2410c;
  margin-bottom: 8rpx;
}

.deadline-desc {
  display: block;
  font-size: 24rpx;
  color: #9a3412;
  line-height: 34rpx;
}

.draft {
  padding: 22rpx 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.draft-row {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
}

.draft-label {
  color: #64748b;
  font-size: 24rpx;
}

.draft-value {
  color: #0f172a;
  font-size: 24rpx;
  font-weight: 600;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.step {
  padding: 24rpx;
}

.step-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.step-head-main {
  flex: 1;
  min-width: 0;
}

.step-head-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}

.step-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
}

.step-sub {
  display: block;
  font-size: 22rpx;
  color: #64748b;
  margin-top: 6rpx;
}

.step-count {
  font-size: 24rpx;
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.08);
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.step-hint {
  display: inline-flex;
  align-items: center;
  font-size: 22rpx;
  line-height: 1;
  color: #b45309;
  background: #fffbeb;
  border: 1rpx solid rgba(245, 158, 11, 0.24);
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.image-item,
.upload-btn {
  width: calc((100% - 32rpx) / 3);
  aspect-ratio: 1 / 1;
  min-height: 180rpx;
}

.image-item {
  position: relative;
}

.preview-image {
  width: 100%;
  height: 100%;
  border-radius: 20rpx;
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.12);
}

.delete-btn {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  line-height: 1;
}

.upload-btn {
  border: 2rpx dashed rgba(79, 70, 229, 0.28);
  border-radius: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(79, 70, 229, 0.06), rgba(79, 70, 229, 0.02));
}

.upload-icon {
  font-size: 60rpx;
  color: #4f46e5;
  line-height: 1;
}

.upload-text {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #475569;
}

.form {
  margin-top: 20rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #0f172a;
  display: block;
}

.input {
  width: 100%;
  height: 88rpx;
  border: 1rpx solid #e2e8f0;
  border-radius: 18rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  background: #fff;
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(247, 248, 252, 0), #f7f8fc 36%, #f7f8fc 100%);
}

.footer .btn-primary {
  width: 100%;
  border-radius: 999rpx;
}
</style>
