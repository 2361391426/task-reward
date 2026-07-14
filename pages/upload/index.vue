<template>
  <view class="container">
    <view class="hero card">
      <view class="hero-copy">
        <text class="eyebrow">提交审核</text>
        <text class="hero-title">按步骤补齐截图并提交</text>
        <text class="hero-desc">草稿会自动保存，重新进入页面时会回显上次填写内容。</text>
      </view>
      <image class="hero-image" src="/static/images/empty-upload.png" mode="aspectFit" />
    </view>

    <view v-if="riskBlocked" class="risk-banner card">
      <text class="risk-title">当前账号已被标记，禁止接单</text>
      <text class="risk-desc">{{ riskReason || '系统检测到异常身份关联，请联系后台处理。' }}</text>
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
          <view>
            <text class="step-title">{{ step.name }}</text>
            <text class="step-sub">请按要求上传对应截图</text>
          </view>
          <text class="step-count">{{ step.images.length }}/{{ step.count }}</text>
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
        type="number"
        maxlength="11"
        placeholder="请输入手机号"
        v-model="phoneNumber"
      />
      <input
        class="input"
        type="text"
        placeholder="请输入常用地址用于风控校验"
        v-model="addressText"
      />
      <input
        class="input"
        type="digit"
        placeholder="请输入实付金额"
        v-model="paidAmount"
      />
    </view>

    <view class="footer">
      <button class="btn-primary" @click="submitTask" :disabled="!canSubmit || submitting">
        {{ submitting ? '提交中...' : (submissionId ? '重新提交审核' : '提交审核') }}
      </button>
    </view>
  </view>
</template>

<script>
import { chooseAndUploadImage } from '../../utils/upload.js'
import { submitTask, resubmitTask, getSubmissionDetail, invalidateTaskCache } from '../../api/task.js'
import { createDraftScheduler } from '../../utils/draft.js'

export default {
  data() {
    return {
      taskId: '',
      submissionId: '',
      phoneNumber: '',
      addressText: '',
      paidAmount: '',
      submitting: false,
      uploadSteps: [
        { id: 1, name: '搜索关键词截图', count: 1, images: [] },
        { id: 2, name: '浏览店铺截图', count: 3, images: [] },
        { id: 3, name: '关注/评论截图', count: 1, images: [] },
        { id: 4, name: '分享截图', count: 1, images: [] },
        { id: 5, name: '详情页截图', count: 1, images: [] },
        { id: 6, name: '加购截图', count: 1, images: [] }
      ]
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
      const phoneValid = /^1[3-9]\d{9}$/.test(this.phoneNumber)
      const addressValid = String(this.addressText || '').trim().length > 0
      const paidValid = Number(this.paidAmount) > 0
      return allImagesUploaded && phoneValid && addressValid && paidValid && !this.riskBlocked
    }
  },

  watch: {
    phoneNumber() {
      this.scheduleSaveDraft()
    },

    addressText() {
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

    if (this.loadDraft()) {
      return
    }

    if (this.submissionId) {
      this.loadSubmissionData()
    }
  },

  onHide() {
    this.flushDraftSave()
  },

  onUnload() {
    this.flushDraftSave()
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
    buildDraftPayload() {
      return {
        taskId: this.taskId,
        submissionId: this.submissionId,
        phoneNumber: this.phoneNumber,
        addressText: this.addressText,
        paidAmount: this.paidAmount,
        uploadSteps: this.uploadSteps.map(step => ({
          id: step.id,
          name: step.name,
          count: step.count,
          images: [...step.images]
        }))
      }
    },

    applyDraft(draft) {
      if (!draft || !Array.isArray(draft.uploadSteps)) return false

      this.phoneNumber = draft.phoneNumber || ''
      this.addressText = draft.addressText || ''
      this.paidAmount = draft.paidAmount || ''
      this.uploadSteps = draft.uploadSteps.map(step => ({
        id: step.id,
        name: step.name,
        count: step.count,
        images: Array.isArray(step.images) ? step.images : []
      }))
      return true
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
        this.uploadSteps[0].images = [res.screenshot_search].filter(Boolean)
        this.uploadSteps[1].images = [res.screenshot_shop_1, res.screenshot_shop_2, res.screenshot_shop_3].filter(Boolean)
        this.uploadSteps[2].images = [res.screenshot_follow].filter(Boolean)
        this.uploadSteps[3].images = [res.screenshot_share].filter(Boolean)
        this.uploadSteps[4].images = [res.screenshot_detail].filter(Boolean)
        this.uploadSteps[5].images = [res.screenshot_cart].filter(Boolean)
        this.phoneNumber = res.phone_number || ''
        this.paidAmount = res.paid_amount ? String(res.paid_amount) : ''
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
          title: this.riskReason || '当前账号已被标记，禁止接单',
          icon: 'none'
        })
        return
      }

      if (!this.canSubmit) {
        uni.showToast({
          title: '请完善所有信息',
          icon: 'none'
        })
        return
      }

      try {
        this.submitting = true
        uni.showLoading({ title: '提交中...' })

        const data = {
          task_id: this.taskId,
          phone_number: this.phoneNumber,
          address_text: this.addressText,
          paid_amount: Number(this.paidAmount),
          screenshot_search: this.uploadSteps[0].images[0],
          screenshot_shop_1: this.uploadSteps[1].images[0],
          screenshot_shop_2: this.uploadSteps[1].images[1],
          screenshot_shop_3: this.uploadSteps[1].images[2],
          screenshot_follow: this.uploadSteps[2].images[0],
          screenshot_share: this.uploadSteps[3].images[0],
          screenshot_detail: this.uploadSteps[4].images[0],
          screenshot_cart: this.uploadSteps[5].images[0]
        }

        if (this.submissionId) {
          await resubmitTask(this.submissionId, data)
        } else {
          await submitTask(data)
        }

        invalidateTaskCache()
        this.clearDraft()
        uni.showToast({
          title: '提交成功',
          icon: 'success'
        })

        setTimeout(() => {
          uni.navigateBack()
        }, 1500)
      } catch (error) {
        console.error('提交失败', error)
      } finally {
        this.submitting = false
        uni.hideLoading()
      }
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
