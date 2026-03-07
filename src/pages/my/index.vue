<template>
  <view class="container">
    <!-- 用户信息卡片 -->
    <view class="user-card card">
      <view class="user-info">
        <image class="avatar" :src="userInfo.avatar || '/static/images/default-avatar.png'" />
        <view class="user-detail">
          <text class="nickname">{{ userInfo.nickname || '未登录' }}</text>
          <text class="phone">{{ userInfo.phone || '未绑定手机' }}</text>
        </view>
      </view>
      
      <view class="earnings-info">
        <view class="earnings-item">
          <text class="earnings-value">¥{{ userInfo.total_earnings || 0 }}</text>
          <text class="earnings-label">累计收益</text>
        </view>
      </view>
    </view>

    <!-- 我的任务 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">我的任务</text>
      </view>
      
      <view class="task-tabs">
        <view 
          class="tab-item" 
          :class="{ active: currentTab === index }"
          v-for="(tab, index) in tabs" 
          :key="index"
          @click="switchTab(index)"
        >
          <text>{{ tab.name }}</text>
          <text class="tab-count" v-if="tab.count > 0">{{ tab.count }}</text>
        </view>
      </view>
      
      <view class="submission-list">
        <view 
          class="submission-item card" 
          v-for="item in submissionList" 
          :key="item.id"
        >
          <view class="item-header">
            <text class="item-title">{{ item.task_title }}</text>
            <view class="status-badge" :class="'status-' + item.review_status">
              {{ getStatusText(item.review_status) }}
            </view>
          </view>
          
          <view class="item-info">
            <text class="info-text">提交时间: {{ formatTime(item.submit_time) }}</text>
            <text class="info-text">奖励金额: ¥{{ item.reward_amount }}</text>
          </view>
          
          <view class="item-note" v-if="item.review_note">
            <text class="note-label">审核备注:</text>
            <text class="note-text">{{ item.review_note }}</text>
          </view>
        </view>
      </view>
      
      <!-- 空状态 -->
      <view v-if="submissionList.length === 0" class="empty">
        <text>暂无记录</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getMySubmissions } from '../../api/task.js'
import { getUserInfo, getEarnings } from '../../api/user.js'

export default {
  data() {
    return {
      userInfo: {},
      currentTab: 0,
      tabs: [
        { name: '全部', status: null, count: 0 },
        { name: '待审核', status: 0, count: 0 },
        { name: '已通过', status: 1, count: 0 },
        { name: '已驳回', status: 2, count: 0 }
      ],
      submissionList: [],
      allSubmissions: []
    }
  },
  
  onShow() {
    this.loadUserInfo()
    this.loadEarnings()
    this.loadSubmissions()
  },
  
  methods: {
    async loadUserInfo() {
      try {
        const res = await getUserInfo()
        this.userInfo = res
      } catch (error) {
        console.error('加载用户信息失败', error)
      }
    },

    async loadEarnings() {
      try {
        const res = await getEarnings()
        this.userInfo.total_earnings = res.total_earnings || 0
      } catch (error) {
        console.error('加载收益信息失败', error)
      }
    },
    
    async loadSubmissions() {
      try {
        const res = await getMySubmissions()
        this.allSubmissions = res.list || []
        this.updateTabCounts()
        this.filterSubmissions()
      } catch (error) {
        console.error('加载提交记录失败', error)
      }
    },
    
    updateTabCounts() {
      this.tabs[0].count = this.allSubmissions.length
      this.tabs[1].count = this.allSubmissions.filter(item => item.review_status === 0).length
      this.tabs[2].count = this.allSubmissions.filter(item => item.review_status === 1).length
      this.tabs[3].count = this.allSubmissions.filter(item => item.review_status === 2).length
    },
    
    switchTab(index) {
      this.currentTab = index
      this.filterSubmissions()
    },
    
    filterSubmissions() {
      const status = this.tabs[this.currentTab].status
      if (status === null) {
        this.submissionList = this.allSubmissions
      } else {
        this.submissionList = this.allSubmissions.filter(item => item.review_status === status)
      }
    },
    
    getStatusText(status) {
      const statusMap = {
        0: '待审核',
        1: '已通过',
        2: '已驳回'
      }
      return statusMap[status] || '未知'
    },
    
    formatTime(time) {
      if (!time) return ''
      const date = new Date(time)
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`
    }
  }
}
</script>

<style scoped>
.user-card {
  margin-bottom: 20rpx;
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 30rpx;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  margin-right: 24rpx;
}

.user-detail {
  display: flex;
  flex-direction: column;
}

.nickname {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.phone {
  font-size: 26rpx;
  color: #999;
}

.earnings-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 30rpx;
  border-radius: 12rpx;
}

.earnings-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.earnings-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 8rpx;
}

.earnings-label {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}

.section {
  margin-top: 20rpx;
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
  background: #fff;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 20rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #666;
  position: relative;
}

.tab-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.tab-count {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  background: #ff4444;
  color: #fff;
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 10rpx;
  min-width: 32rpx;
  text-align: center;
}

.submission-list {
  margin-top: 20rpx;
}

.submission-item {
  margin-bottom: 20rpx;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.item-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  flex: 1;
}

.status-badge {
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
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
  color: #666;
}

.item-note {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
}

.note-label {
  font-size: 26rpx;
  color: #999;
  margin-right: 8rpx;
}

.note-text {
  font-size: 26rpx;
  color: #ff4444;
}

.empty {
  text-align: center;
  padding: 100rpx 0;
  color: #999;
}
</style>
