<template>
  <view class="container">
    <!-- 顶部统计 -->
    <view class="stats-card card">
      <view class="stats-item">
        <text class="stats-value">{{ totalTasks }}</text>
        <text class="stats-label">可接任务</text>
      </view>
      <view class="stats-item">
        <text class="stats-value">¥{{ totalEarnings }}</text>
        <text class="stats-label">累计收益</text>
      </view>
    </view>

    <!-- 任务列表 -->
    <view class="task-list">
      <view 
        class="task-card card" 
        v-for="task in taskList" 
        :key="task.id"
        @click="goToDetail(task.id)"
      >
        <view class="task-header">
          <text class="task-title">{{ task.title }}</text>
          <view class="task-reward">
            <text class="reward-amount">¥{{ task.reward_amount }}</text>
          </view>
        </view>
        
        <view class="task-info">
          <text class="info-item">关键词: {{ task.search_keyword }}</text>
          <text class="info-item">剩余: {{ task.total_quota - task.used_quota }}份</text>
        </view>
        
        <view class="task-footer">
          <text class="task-time">{{ formatTime(task.end_time) }}</text>
          <view class="task-btn">立即参与</view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="taskList.length === 0" class="empty">
      <text>暂无任务</text>
    </view>
  </view>
</template>

<script>
import { getTaskList } from '../../api/task.js'

export default {
  data() {
    return {
      taskList: [],
      totalTasks: 0,
      totalEarnings: 0
    }
  },
  
  onLoad() {
    this.loadTasks()
    this.loadUserStats()
  },
  
  onPullDownRefresh() {
    this.loadTasks()
    setTimeout(() => {
      uni.stopPullDownRefresh()
    }, 1000)
  },
  
  methods: {
    async loadTasks() {
      try {
        const res = await getTaskList({ status: 1 })
        this.taskList = res.list || []
        this.totalTasks = res.total || 0
      } catch (error) {
        console.error('加载任务失败', error)
      }
    },
    
    async loadUserStats() {
      // 加载用户统计数据
      const earnings = uni.getStorageSync('totalEarnings') || 0
      this.totalEarnings = earnings
    },
    
    goToDetail(id) {
      uni.navigateTo({
        url: `/pages/task-detail/index?id=${id}`
      })
    },
    
    formatTime(time) {
      if (!time) return ''
      const date = new Date(time)
      return `${date.getMonth() + 1}月${date.getDate()}日截止`
    }
  }
}
</script>

<style scoped>
.stats-card {
  display: flex;
  justify-content: space-around;
  padding: 40rpx;
  margin-bottom: 20rpx;
}

.stats-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stats-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 8rpx;
}

.stats-label {
  font-size: 24rpx;
  color: #999;
}

.task-list {
  margin-top: 20rpx;
}

.task-card {
  margin-bottom: 20rpx;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.task-title {
  font-size: 32rpx;
  font-weight: 500;
  color: #333;
  flex: 1;
}

.task-reward {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.reward-amount {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.task-info {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.info-item {
  font-size: 26rpx;
  color: #666;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}

.task-time {
  font-size: 24rpx;
  color: #999;
}

.task-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 12rpx 32rpx;
  border-radius: 20rpx;
  font-size: 26rpx;
}

.empty {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
}
</style>
