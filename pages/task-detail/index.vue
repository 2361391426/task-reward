<template>
  <view class="container">
    <view class="detail-card card">
      <!-- 任务标题和奖励 -->
      <view class="header">
        <text class="title">{{ task.title }}</text>
        <view class="reward">
          <text class="reward-label">任务奖励</text>
          <text class="reward-amount">¥{{ task.reward_amount }}</text>
        </view>
      </view>

      <!-- 任务信息 -->
      <view class="info-section">
        <view class="info-item">
          <text class="label">搜索关键词:</text>
          <text class="value">{{ task.search_keyword }}</text>
        </view>
        <view class="info-item">
          <text class="label">店铺名称:</text>
          <text class="value">{{ task.shop_name }}</text>
        </view>
        <view class="info-item">
          <text class="label">商品名称:</text>
          <text class="value">{{ task.product_name }}</text>
        </view>
        <view class="info-item">
          <text class="label">剩余名额:</text>
          <text class="value">{{ task.total_quota - task.used_quota }}/{{ task.total_quota }}</text>
        </view>
      </view>

      <!-- 任务要求 -->
      <view class="requirements">
        <text class="section-title">任务要求</text>
        <view class="req-list">
          <view class="req-item">
            <text class="req-num">1</text>
            <text class="req-text">搜索关键词截图（1张）</text>
          </view>
          <view class="req-item">
            <text class="req-num">2</text>
            <text class="req-text">浏览其他店铺截图（3张）</text>
          </view>
          <view class="req-item">
            <text class="req-num">3</text>
            <text class="req-text">主图点关注评论截图（1张）</text>
          </view>
          <view class="req-item">
            <text class="req-num">4</text>
            <text class="req-text">分享截图（1张）</text>
          </view>
          <view class="req-item">
            <text class="req-num">5</text>
            <text class="req-text">商品详情页浏览截图（1张）</text>
          </view>
          <view class="req-item">
            <text class="req-num">6</text>
            <text class="req-text">商品加购截图（1张）</text>
          </view>
        </view>
      </view>

      <!-- 注意事项 -->
      <view class="notice">
        <text class="notice-title">⚠️ 注意事项</text>
        <text class="notice-text">1. 本隔日晚上22点返本，好评之后返佣8</text>
        <text class="notice-text">2. 签收次日任意时间评价，好评问我要</text>
        <text class="notice-text">3. 电话号码写自己的，不要乱写，防止快递伴侣出现问题</text>
        <text class="notice-text">4. 必须主图点关注（不是该渠道关注任务取消）</text>
        <text class="notice-text">5. 评论分享主贴子截图</text>
        <text class="notice-text">6. 点击主贴子商品卡片加购商品截图</text>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="footer">
      <button class="btn-primary" @click="startTask">开始任务</button>
    </view>
  </view>
</template>

<script>
import { getTaskDetail } from '../../api/task.js'

export default {
  data() {
    return {
      taskId: '',
      task: {}
    }
  },
  
  onLoad(options) {
    this.taskId = options.id
    this.loadTaskDetail()
  },
  
  methods: {
    async loadTaskDetail() {
      try {
        const res = await getTaskDetail(this.taskId)
        this.task = res
      } catch (error) {
        console.error('加载任务详情失败', error)
      }
    },
    
    startTask() {
      uni.navigateTo({
        url: `/pages/upload/index?taskId=${this.taskId}`
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
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.reward {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20rpx;
  border-radius: 12rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reward-label {
  color: #fff;
  font-size: 28rpx;
}

.reward-amount {
  color: #fff;
  font-size: 48rpx;
  font-weight: bold;
}

.info-section {
  margin-bottom: 30rpx;
}

.info-item {
  display: flex;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.label {
  font-size: 28rpx;
  color: #666;
  width: 200rpx;
}

.value {
  font-size: 28rpx;
  color: #333;
  flex: 1;
}

.requirements {
  margin-bottom: 30rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.req-list {
  background: #f8f9fa;
  padding: 20rpx;
  border-radius: 12rpx;
}

.req-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
}

.req-num {
  width: 48rpx;
  height: 48rpx;
  background: #667eea;
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
  color: #333;
}

.notice {
  background: #fff3cd;
  padding: 20rpx;
  border-radius: 12rpx;
  border-left: 4rpx solid #ffc107;
}

.notice-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #856404;
  display: block;
  margin-bottom: 16rpx;
}

.notice-text {
  font-size: 26rpx;
  color: #856404;
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
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.05);
}
</style>
