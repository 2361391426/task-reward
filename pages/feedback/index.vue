<template>
  <view class="container">
    <view class="hero card">
      <text class="hero-title">意见反馈</text>
      <text class="hero-desc">你可以在这里提交问题、建议或投诉，后台回复后会同步显示。</text>
    </view>

    <view class="form card">
      <text class="section-title">提交反馈</text>

      <picker :range="categoryOptions" range-key="label" @change="handleCategoryChange">
        <view class="picker-row">
          <text class="picker-label">反馈类型</text>
          <text class="picker-value">{{ currentCategory.label }}</text>
        </view>
      </picker>

      <textarea
        class="textarea"
        v-model="content"
        maxlength="500"
        placeholder="请尽量描述清楚问题现象、页面位置、操作步骤或建议内容"
      />

      <input
        class="input"
        type="text"
        v-model="contactInfo"
        placeholder="可填写手机号、微信号或其他联系方式，方便后台联系你"
      />

      <view class="media-box">
        <view class="media-head">
          <text class="section-subtitle">附件</text>
          <text class="media-tip">{{ attachments.length }}/6</text>
        </view>

        <view class="media-actions">
          <button class="media-btn" :disabled="submitting || attachments.length >= 6" @click="chooseImage">
            添加图片
          </button>
          <button class="media-btn" :disabled="submitting || attachments.length >= 6" @click="chooseVideo">
            添加视频
          </button>
        </view>

        <view v-if="attachments.length > 0" class="attachment-list">
          <view v-for="(item, index) in attachments" :key="item.url + index" class="attachment-item">
            <image
              v-if="item.type === 'image'"
              class="attachment-image"
              :src="item.url"
              mode="aspectFill"
              @click="previewAttachment(index)"
            />

            <video
              v-else
              class="attachment-video"
              :src="item.url"
              controls
              object-fit="cover"
            />

            <view class="attachment-mask" @click="removeAttachment(index)">
              <text class="attachment-remove">移除</text>
            </view>
          </view>
        </view>
      </view>

      <button class="btn-primary" :disabled="submitting || !canSubmit" @click="submit">
        {{ submitting ? '提交中...' : '提交反馈' }}
      </button>
    </view>

    <view class="history card">
      <view class="history-head">
        <text class="section-title">我的反馈</text>
        <text class="history-tip">后台回复后会显示在这里</text>
      </view>

      <view v-if="loading" class="empty">
        <text>加载中...</text>
      </view>

      <view v-else-if="feedbackList.length === 0" class="empty">
        <text>暂无反馈记录</text>
      </view>

      <view v-else class="feedback-list">
        <view v-for="item in feedbackList" :key="item.id" class="feedback-item">
          <view class="feedback-top">
            <text class="feedback-title">{{ categoryText(item.category) }}</text>
            <text class="feedback-status" :class="'status-' + Number(item.status)">{{ statusText(item.status) }}</text>
          </view>

          <text class="feedback-content">{{ item.content }}</text>
          <text class="feedback-meta">提交时间：{{ formatTime(item.created_at) }}</text>
          <text v-if="item.contact_info" class="feedback-meta">联系方式：{{ item.contact_info }}</text>

          <view v-if="mediaItems(item).length" class="history-media">
            <view v-for="(media, mediaIndex) in mediaItems(item)" :key="media.url + mediaIndex" class="history-media-item">
              <image
                v-if="media.type === 'image'"
                class="history-media-image"
                :src="media.url"
                mode="aspectFill"
                @click="previewHistoryMedia(item, mediaIndex)"
              />
              <video
                v-else
                class="history-media-video"
                :src="media.url"
                controls
                object-fit="cover"
              />
            </view>
          </view>

          <view v-if="item.reply_content" class="reply-box">
            <text class="reply-label">后台回复</text>
            <text class="reply-content">{{ item.reply_content }}</text>
            <text v-if="item.replied_at" class="feedback-meta">回复时间：{{ formatTime(item.replied_at) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { formatTime } from '../../utils/format.js'
import { chooseAndUploadImage, uploadImage } from '../../utils/upload.js'
import { getMyFeedbacks, submitFeedback } from '../../api/feedback.js'

const CATEGORY_OPTIONS = [
  { value: 'general', label: '功能反馈' },
  { value: 'bug', label: '问题报错' },
  { value: 'suggestion', label: '优化建议' },
  { value: 'complaint', label: '投诉申诉' }
]

const parseAttachments = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      return []
    }
  }
  return []
}

export default {
  data() {
    return {
      loading: false,
      submitting: false,
      feedbackList: [],
      content: '',
      contactInfo: '',
      attachments: [],
      categoryOptions: CATEGORY_OPTIONS,
      currentCategory: CATEGORY_OPTIONS[0]
    }
  },

  computed: {
    canSubmit() {
      return String(this.content || '').trim().length > 0
    }
  },

  onLoad() {
    this.loadFeedbacks()
  },

  onPullDownRefresh() {
    this.loadFeedbacks().finally(() => uni.stopPullDownRefresh())
  },

  methods: {
    formatTime,

    categoryText(value) {
      const found = CATEGORY_OPTIONS.find((item) => item.value === value)
      return found ? found.label : '未知类型'
    },

    statusText(value) {
      const map = {
        0: '待处理',
        1: '处理中',
        2: '已回复',
        3: '已关闭'
      }
      return map[Number(value)] || '待处理'
    },

    mediaItems(item) {
      return parseAttachments(item && item.attachments)
    },

    handleCategoryChange(event) {
      const index = Number(event.detail.value)
      this.currentCategory = this.categoryOptions[index] || this.categoryOptions[0]
    },

    async chooseImage() {
      try {
        const urls = await chooseAndUploadImage(6 - this.attachments.length)
        urls.forEach((url) => {
          this.attachments.push({ type: 'image', url })
        })
      } catch (error) {
        console.error('选择图片失败', error)
      }
    },

    chooseVideo() {
      if (this.attachments.length >= 6) {
        return
      }

      uni.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        success: async (res) => {
          const file = Array.isArray(res.tempFiles) ? res.tempFiles[0] : null
          const tempPath = file && (file.tempFilePath || file.tempFile)
          if (!tempPath) {
            uni.showToast({ title: '未获取到视频文件', icon: 'none' })
            return
          }

          try {
            uni.showLoading({ title: '上传视频中...' })
            const url = await uploadImage(tempPath)
            this.attachments.push({ type: 'video', url })
          } catch (error) {
            console.error('上传视频失败', error)
            uni.showToast({ title: '视频上传失败', icon: 'none' })
          } finally {
            uni.hideLoading()
          }
        },
        fail: () => {
          uni.showToast({ title: '已取消选择', icon: 'none' })
        }
      })
    },

    removeAttachment(index) {
      this.attachments.splice(index, 1)
    },

    previewAttachment(index) {
      const images = this.attachments.filter((item) => item.type === 'image').map((item) => item.url)
      const current = this.attachments[index]
      if (!current || current.type !== 'image') return
      uni.previewImage({
        urls: images,
        current: current.url
      })
    },

    previewHistoryMedia(item, mediaIndex) {
      const mediaList = this.mediaItems(item).filter((media) => media.type === 'image')
      const current = this.mediaItems(item)[mediaIndex]
      if (!current || current.type !== 'image') return
      uni.previewImage({
        urls: mediaList.map((media) => media.url),
        current: current.url
      })
    },

    async loadFeedbacks() {
      try {
        this.loading = true
        const res = await getMyFeedbacks()
        this.feedbackList = Array.isArray(res && res.list) ? res.list : []
      } catch (error) {
        console.error('加载反馈失败', error)
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    async submit() {
      if (!this.canSubmit || this.submitting) {
        return
      }

      try {
        this.submitting = true
        await submitFeedback({
          category: this.currentCategory.value,
          content: String(this.content || '').trim(),
          contact_info: String(this.contactInfo || '').trim(),
          attachments: this.attachments
        })
        uni.showToast({ title: '提交成功', icon: 'success' })
        this.content = ''
        this.contactInfo = ''
        this.attachments = []
        this.currentCategory = this.categoryOptions[0]
        await this.loadFeedbacks()
      } catch (error) {
        console.error('提交反馈失败', error)
        uni.showToast({ title: error && error.message ? error.message : '提交失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f7f9ff 0%, #eef2ff 100%);
}

.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 12rpx 30rpx rgba(56, 73, 130, 0.08);
}

.hero {
  background: linear-gradient(135deg, #5b7cff 0%, #7e4df5 100%);
  color: #fff;
}

.hero-title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}

.hero-desc {
  display: block;
  font-size: 24rpx;
  line-height: 1.6;
  opacity: 0.92;
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2d4d;
  margin-bottom: 20rpx;
}

.section-subtitle {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #36415f;
}

.picker-row,
.input,
.textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e6eaf4;
  border-radius: 18rpx;
  background: #f9fbff;
}

.picker-row {
  min-height: 88rpx;
  padding: 0 24rpx;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.picker-label,
.picker-value {
  font-size: 26rpx;
  color: #3d4a66;
}

.picker-value {
  color: #5b7cff;
  font-weight: 600;
}

.textarea {
  min-height: 220rpx;
  padding: 22rpx 24rpx;
  margin-bottom: 20rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

.input {
  height: 88rpx;
  padding: 0 24rpx;
  margin-bottom: 24rpx;
  font-size: 26rpx;
}

.media-box {
  margin-bottom: 24rpx;
  padding: 22rpx;
  border: 1px dashed #d7def2;
  border-radius: 18rpx;
  background: #fbfcff;
}

.media-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.media-tip {
  font-size: 22rpx;
  color: #8b98b5;
}

.media-actions {
  display: flex;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.media-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 16rpx;
  background: #eef2ff;
  color: #4f67d7;
  font-size: 26rpx;
  font-weight: 600;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.attachment-item {
  position: relative;
  width: calc(50% - 8rpx);
  min-height: 200rpx;
  overflow: hidden;
  border-radius: 16rpx;
  background: #f4f7ff;
}

.attachment-image,
.attachment-video {
  width: 100%;
  height: 200rpx;
}

.attachment-mask {
  position: absolute;
  top: 0;
  right: 0;
  padding: 12rpx 16rpx;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  border-bottom-left-radius: 16rpx;
}

.attachment-remove {
  font-size: 22rpx;
}

.btn-primary {
  border-radius: 18rpx;
  background: linear-gradient(135deg, #4f7cff 0%, #5f46ff 100%);
  color: #fff;
  font-weight: 700;
}

.btn-primary[disabled] {
  opacity: 0.45;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.history-tip {
  font-size: 22rpx;
  color: #7f8fb3;
}

.empty {
  padding: 60rpx 0;
  text-align: center;
  color: #9aa7c3;
  font-size: 26rpx;
}

.feedback-item {
  padding: 22rpx 0;
  border-top: 1px solid #edf1f8;
}

.feedback-item:first-child {
  border-top: 0;
  padding-top: 0;
}

.feedback-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.feedback-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2d4d;
}

.feedback-status {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #5b7cff;
}

.status-0,
.status-1 {
  background: #fff5e6;
  color: #d98300;
}

.status-2 {
  background: #e8fbef;
  color: #1f9d55;
}

.status-3 {
  background: #f1f3f7;
  color: #8b98b5;
}

.feedback-content {
  display: block;
  font-size: 26rpx;
  color: #3d4a66;
  line-height: 1.7;
  margin-bottom: 10rpx;
  word-break: break-all;
}

.feedback-meta {
  display: block;
  font-size: 22rpx;
  color: #8b98b5;
  margin-top: 6rpx;
}

.history-media {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.history-media-item {
  width: calc(50% - 6rpx);
  border-radius: 14rpx;
  overflow: hidden;
  background: #f4f7ff;
}

.history-media-image,
.history-media-video {
  width: 100%;
  height: 180rpx;
}

.reply-box {
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: #f7f9ff;
  border: 1px solid #e7ecff;
}

.reply-label {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #5b7cff;
  margin-bottom: 8rpx;
}

.reply-content {
  display: block;
  font-size: 24rpx;
  color: #36415f;
  line-height: 1.6;
  word-break: break-all;
}
</style>
