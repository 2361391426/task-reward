<template>
  <view class="container">
    <!-- 上传步骤 -->
    <view class="upload-steps">
      <view 
        class="step-item" 
        v-for="(step, index) in uploadSteps" 
        :key="step.id"
      >
        <view class="step-header">
          <text class="step-title">{{ step.name }}</text>
          <text class="step-count">{{ step.images.length }}/{{ step.count }}</text>
        </view>
        
        <view class="image-list">
          <!-- 已上传的图片 -->
          <view 
            class="image-item" 
            v-for="(img, imgIndex) in step.images" 
            :key="imgIndex"
          >
            <image :src="img" mode="aspectFill" class="preview-image" />
            <view class="delete-btn" @click="deleteImage(index, imgIndex)">
              <text>×</text>
            </view>
          </view>
          
          <!-- 上传按钮 -->
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

    <!-- 手机号输入 -->
    <view class="phone-section card">
      <text class="section-title">联系方式</text>
      <input 
        class="phone-input" 
        type="number" 
        maxlength="11"
        placeholder="请输入手机号（用于返现）" 
        v-model="phoneNumber"
      />
    </view>

    <!-- 提交按钮 -->
    <view class="footer">
      <button class="btn-primary" @click="submitTask" :disabled="!canSubmit">
        提交审核
      </button>
    </view>
  </view>
</template>

<script>
import { chooseAndUploadImage } from '../../utils/upload.js'
import { submitTask } from '../../api/task.js'

export default {
  data() {
    return {
      taskId: '',
      phoneNumber: '',
      uploadSteps: [
        { id: 1, name: '搜索关键词截图', count: 1, images: [] },
        { id: 2, name: '浏览其他店铺截图', count: 3, images: [] },
        { id: 3, name: '主图点关注评论截图', count: 1, images: [] },
        { id: 4, name: '分享截图', count: 1, images: [] },
        { id: 5, name: '商品详情页浏览截图', count: 1, images: [] },
        { id: 6, name: '商品加购截图', count: 1, images: [] }
      ]
    }
  },
  
  computed: {
    canSubmit() {
      // 检查所有图片是否上传完成
      const allImagesUploaded = this.uploadSteps.every(step => 
        step.images.length === step.count
      )
      // 检查手机号是否填写
      const phoneValid = /^1[3-9]\d{9}$/.test(this.phoneNumber)
      return allImagesUploaded && phoneValid
    }
  },
  
  onLoad(options) {
    this.taskId = options.taskId
  },
  
  methods: {
    async chooseImage(stepIndex) {
      const step = this.uploadSteps[stepIndex]
      const remainCount = step.count - step.images.length
      
      try {
        const urls = await chooseAndUploadImage(remainCount)
        step.images.push(...urls)
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
          }
        }
      })
    },
    
    async submitTask() {
      if (!this.canSubmit) {
        uni.showToast({
          title: '请完成所有步骤',
          icon: 'none'
        })
        return
      }
      
      try {
        uni.showLoading({ title: '提交中...' })
        
        const data = {
          task_id: this.taskId,
          phone_number: this.phoneNumber,
          screenshot_search: this.uploadSteps[0].images[0],
          screenshot_shop_1: this.uploadSteps[1].images[0],
          screenshot_shop_2: this.uploadSteps[1].images[1],
          screenshot_shop_3: this.uploadSteps[1].images[2],
          screenshot_follow: this.uploadSteps[2].images[0],
          screenshot_share: this.uploadSteps[3].images[0],
          screenshot_detail: this.uploadSteps[4].images[0],
          screenshot_cart: this.uploadSteps[5].images[0]
        }
        
        await submitTask(data)
        
        uni.hideLoading()
        uni.showToast({
          title: '提交成功',
          icon: 'success'
        })
        
        setTimeout(() => {
          uni.navigateBack()
        }, 1500)
        
      } catch (error) {
        uni.hideLoading()
        console.error('提交失败', error)
      }
    }
  }
}
</script>

<style scoped>
.container {
  padding-bottom: 120rpx;
}

.upload-steps {
  margin-bottom: 20rpx;
}

.step-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.step-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.step-count {
  font-size: 26rpx;
  color: #667eea;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.image-item {
  position: relative;
  width: 200rpx;
  height: 200rpx;
}

.preview-image {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
}

.delete-btn {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 48rpx;
  height: 48rpx;
  background: #ff4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 36rpx;
  line-height: 1;
}

.upload-btn {
  width: 200rpx;
  height: 200rpx;
  border: 2rpx dashed #ddd;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}

.upload-icon {
  font-size: 60rpx;
  color: #999;
  line-height: 1;
}

.upload-text {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.phone-section {
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.phone-input {
  width: 100%;
  height: 80rpx;
  border: 1rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx;
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.05);
}

button[disabled] {
  opacity: 0.5;
}
</style>
