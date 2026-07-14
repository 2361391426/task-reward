<template>
  <view class="container">
    <view class="stats-card card">
      <view class="stats-item">
        <text class="stats-value">{{ totalTasks }}</text>
        <text class="stats-label">可接任务</text>
      </view>
      <view class="stats-item">
        <text class="stats-value">¥{{ totalEarnings }}</text>
        <text class="stats-label">累计收益</text>
      </view>
      <image class="stats-visual" src="/static/images/hero-task.png" mode="aspectFit" />
    </view>

    <scroll-view class="platform-filter" scroll-x="true" show-scrollbar="false">
      <view class="platform-filter-track">
        <view
          v-for="tab in platformTabs"
          :key="tab.value"
          class="platform-chip"
          :class="{ active: currentPlatform === tab.value }"
          @click="switchPlatform(tab.value)"
        >
          <text>{{ tab.label }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="riskBlocked()" class="risk-panel">
      <text class="risk-title">当前账号已被标记，禁止接单</text>
      <text class="risk-text">{{ riskReason() || '系统检测到异常身份关联，请联系后台处理。' }}</text>
    </view>

    <view v-if="loadError" class="error-panel">
      <text class="error-title">加载失败</text>
      <text class="error-text">{{ loadError }}</text>
      <button class="btn-secondary" @click="retryLoad">重试</button>
    </view>

    <view class="task-list" v-if="!loading && taskList.length">
      <view
        class="task-card card"
        v-for="task in taskList"
        :key="task.id"
        @click="goToDetail(task.id)"
      >
        <view class="task-header">
          <view class="title-wrap">
            <text class="task-title">{{ task.title || '任务' }}</text>
            <text class="task-platform">{{ platformText(task.platform) }}</text>
          </view>
          <view class="task-reward">
            <text class="reward-amount">¥{{ task.reward_amount || 0 }}</text>
          </view>
        </view>

        <view class="task-info">
          <text class="info-item">关键词: {{ task.search_keyword || '-' }}</text>
          <text class="info-item">剩余: {{ remainingQuota(task) }} 单</text>
        </view>

        <view class="task-footer">
          <text class="task-time">{{ formatTime(task.end_time) }}</text>
          <view class="task-btn">{{ taskActionText(task) }}</view>
        </view>
      </view>
    </view>

    <view v-if="!loading && taskList.length && (loadingMore || taskHasMore)" class="load-more">
      <text v-if="loadingMore">加载更多中...</text>
      <text v-else>上拉加载更多</text>
    </view>

    <view v-if="!loading && taskList.length && !taskHasMore" class="load-more">
      <text>没有更多任务了</text>
    </view>

    <view v-if="!loading && taskList.length === 0" class="empty">
      <image class="empty-illustration" src="/static/images/empty-task.png" mode="aspectFit" />
      <text>暂无任务</text>
    </view>

    <view v-if="loading" class="empty">
      <image class="empty-illustration" src="/static/images/hero-task.png" mode="aspectFit" />
      <text>加载中...</text>
    </view>
  </view>
</template>

<script>
import { getTaskList, getMySubmissions } from '../../api/task.js'
import { getEarnings, getUserInfo } from '../../api/user.js'
import { formatTime, platformText, submissionStatusText } from '../../utils/format.js'

export default {
  data() {
    return {
      taskList: [],
      totalTasks: 0,
      totalEarnings: 0,
      loading: true,
      loadingMore: false,
      taskPage: 1,
      taskPageSize: 10,
      taskHasMore: true,
      currentPlatform: '',
      platformTabs: [
        { label: '全部', value: '' },
        { label: '淘宝', value: 'taobao' },
        { label: '京东', value: 'jd' },
        { label: '抖音', value: 'douyin' },
        { label: '小红书', value: 'xiaohongshu' }
      ],
      submissionMap: {},
      userInfo: {},
      loadError: ''
    }
  },

  onShow() {
    this.refreshData(true)
  },

  async onPullDownRefresh() {
    try {
      await this.refreshData(true)
    } finally {
      uni.stopPullDownRefresh()
    }
  },

  onReachBottom() {
    if (this.loading || this.loadingMore || !this.taskHasMore || this.loadError) {
      return
    }
    this.loadMoreTasks()
  },

  onShareAppMessage() {
    const platform = this.platformTabs.find(tab => tab.value === this.currentPlatform)?.label || '全部'
    return {
      title: `任务大厅 - ${platform}任务`,
      path: '/pages/index/index'
    }
  },

  methods: {
    async refreshData() {
      this.loadError = ''
      this.taskPage = 1
      this.taskHasMore = true
      try {
        const taskLoaded = await this.loadTasks(true)
        const visibleTaskIds = this.taskList.map(task => String(task.id)).filter(Boolean)
        const [statsLoaded, submissionsLoaded] = await Promise.all([
          this.loadUserInfo(),
          this.loadUserStats(),
          this.loadMySubmissions(true, visibleTaskIds)
        ])
        if ((!taskLoaded || !statsLoaded || !submissionsLoaded) && !this.loadError) {
          this.loadError = '部分数据加载失败，请稍后重试'
        }
      } catch (error) {
        console.error('刷新首页失败', error)
        this.loadError = this.loadError || '首页加载失败，请重试'
      }
    },

    async loadTasks(reset = false) {
      try {
        const page = reset ? 1 : this.taskPage
        if (reset) {
          this.loading = true
          this.taskList = []
        } else {
          this.loadingMore = true
        }
        const params = {
          status: 1,
          page,
          page_size: this.taskPageSize
        }
        if (this.currentPlatform) {
          params.platform = this.currentPlatform
        }
        const res = await getTaskList(params, { forceRefresh: reset })
        const list = Array.isArray(res && res.list) ? res.list : []
        this.totalTasks = res && typeof res.total === 'number' ? res.total : this.taskList.length + list.length
        this.taskList = reset ? list : this.taskList.concat(list)
        const pageSize = res && typeof res.page_size === 'number' ? res.page_size : this.taskPageSize
        this.taskPage = page + 1
        this.taskHasMore = this.taskList.length < this.totalTasks && list.length >= pageSize
        return true
      } catch (error) {
        console.error('加载任务失败', error)
        this.loadError = this.loadError || '首页任务加载失败，请重试'
        return false
      } finally {
        this.loading = false
        this.loadingMore = false
      }
    },

    async loadUserStats() {
      try {
        const res = await getEarnings()
        this.totalEarnings = Number(res && res.total_earnings) || 0
        return true
      } catch (error) {
        console.error('加载收益信息失败', error)
        this.totalEarnings = Number(uni.getStorageSync('totalEarnings') || 0)
        return false
      }
    },

    async loadUserInfo() {
      try {
        const res = await getUserInfo()
        this.userInfo = res || {}
        try {
          uni.setStorageSync('userInfo', this.userInfo)
        } catch (error) {}
        return true
      } catch (error) {
        console.error('鍔犺浇鐢ㄦ埛淇℃伅澶辫触', error)
        return false
      }
    },

    async loadMySubmissions(forceRefresh = false, targetTaskIds = []) {
      try {
        const targetIds = new Set((targetTaskIds || []).map(id => String(id)))
        const submissionMap = {}

        if (targetIds.size > 0) {
          const res = await getMySubmissions(
            {
              task_ids: Array.from(targetIds).join(','),
              page_size: targetIds.size
            },
            { forceRefresh }
          )
          const list = Array.isArray(res && res.list) ? res.list : []
          list.forEach(item => {
            if (!item || item.task_id === undefined || item.task_id === null) return
            const taskId = String(item.task_id)
            if (targetIds.has(taskId)) {
              submissionMap[taskId] = item
            }
          })
        } else {
          let page = 1
          let hasMore = true
          const pageSize = 50

          while (hasMore) {
            const res = await getMySubmissions({ page, page_size: pageSize }, { forceRefresh: forceRefresh && page === 1 })
            const pageList = Array.isArray(res && res.list) ? res.list : []
            pageList.forEach(item => {
              if (!item || item.task_id === undefined || item.task_id === null) return
              submissionMap[String(item.task_id)] = item
            })
            const total = res && typeof res.total === 'number' ? res.total : (page - 1) * pageSize + pageList.length
            const returnedPageSize = res && typeof res.page_size === 'number' ? res.page_size : pageSize
            const fetchedCount = (page - 1) * pageSize + pageList.length
            hasMore = fetchedCount < total && pageList.length >= returnedPageSize
            page += 1
            if (!hasMore) break
          }
        }

        this.submissionMap = targetIds.size ? { ...this.submissionMap, ...submissionMap } : submissionMap
        return true
      } catch (error) {
        console.error('加载我的提交失败', error)
        if (!targetTaskIds || targetTaskIds.length === 0) {
          this.submissionMap = {}
        }
        this.loadError = this.loadError || '首页提交记录加载失败，请重试'
        return false
      }
    },

    goToDetail(id) {
      if (!id) {
        uni.showToast({ title: '任务信息缺失', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/task-detail/index?id=${id}`
      })
    },

    retryLoad() {
      this.refreshData()
    },

    loadMoreTasks() {
      if (!this.taskHasMore || this.loadingMore) {
        return
      }
      const existingTaskIds = new Set(this.taskList.map(task => String(task.id)).filter(Boolean))
      this.loadTasks(false)
        .then(() => {
          const appendedTaskIds = this.taskList
            .map(task => String(task.id))
            .filter(id => id && !existingTaskIds.has(id))
          return this.loadMySubmissions(false, appendedTaskIds)
        })
        .catch((error) => {
          console.error('加载更多任务失败', error)
        })
    },

    switchPlatform(platform) {
      if (this.currentPlatform === platform) {
        return
      }
      this.currentPlatform = platform
      this.refreshData(true)
    },

    riskBlocked() {
      return Number(this.userInfo?.risk_status) === 1
    },

    riskReason() {
      return this.userInfo?.risk_reason || ''
    },

    remainingQuota(task) {
      const remaining = task.remaining_quota
      if (remaining !== undefined && remaining !== null) {
        return Number(remaining) || 0
      }
      const total = Number(task.total_quota || 0)
      const used = Number(task.used_quota || 0)
      return Math.max(total - used, 0)
    },

    taskActionText(task) {
      if (this.riskBlocked()) {
        return '禁止接单'
      }
      const submission = this.submissionMap[String(task.id)]
      if (!submission) {
        return '立即参与'
      }
      const status = Number(submission.review_status)
      if (status === 2) {
        return '重新提交'
      }
      return submissionStatusText(status)
    },

    formatTime(time) {
      return formatTime(time)
    },

    platformText(platform) {
      return platformText(platform)
    }
  }
}
</script>

<style scoped>
.stats-card {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  padding: 28rpx;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.95), rgba(118, 75, 162, 0.92));
  color: #fff;
}

.platform-filter {
  white-space: nowrap;
  margin: 2rpx 0 18rpx;
}

.platform-filter-track {
  display: flex;
  gap: 14rpx;
  padding-bottom: 8rpx;
}

.platform-chip {
  flex-shrink: 0;
  padding: 16rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(148, 163, 184, 0.18);
  color: #475569;
  font-size: 24rpx;
}

.platform-chip.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  box-shadow: 0 10rpx 24rpx rgba(102, 126, 234, 0.18);
}

.stats-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.stats-value {
  color: #fff;
  font-size: 52rpx;
  line-height: 1;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.stats-label {
  color: rgba(255, 255, 255, 0.78);
  font-size: 24rpx;
}

.task-list {
  margin-top: 0;
}

.load-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20rpx 0 8rpx;
  color: #64748b;
  font-size: 24rpx;
}

.task-card {
  margin-bottom: 20rpx;
  overflow: hidden;
  border: 1rpx solid rgba(226, 232, 240, 0.9);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.title-wrap {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  flex: 1;
}

.task-title {
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.35;
  color: #0f172a;
}

.task-platform {
  font-size: 22rpx;
  color: #64748b;
}

.task-reward {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  box-shadow: 0 10rpx 20rpx rgba(102, 126, 234, 0.18);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.reward-amount {
  font-size: 32rpx;
  font-weight: 700;
  color: #fff;
}

.task-info {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-bottom: 20rpx;
}

.info-item {
  color: #475569;
  font-size: 25rpx;
}

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 18rpx;
  border-top: 1rpx solid #eef2f7;
}

.task-time {
  color: #94a3b8;
  font-size: 24rpx;
}

.task-btn {
  border-radius: 999rpx;
  padding: 14rpx 26rpx;
  font-size: 24rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 12rpx 24rpx rgba(102, 126, 234, 0.22);
  color: #fff;
}

.stats-visual {
  grid-column: 1 / -1;
  width: 100%;
  height: 170rpx;
  margin-top: 6rpx;
}

.risk-panel {
  background: #fff1f2;
  border: 1rpx solid rgba(244, 63, 94, 0.16);
  border-radius: 20rpx;
  padding: 20rpx;
  margin: 18rpx 0 20rpx;
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

.empty {
  text-align: center;
  padding: 100rpx 0;
  color: #94a3b8;
  font-size: 26rpx;
}

.empty-illustration {
  width: 280rpx;
  height: 170rpx;
  margin: 0 auto 20rpx;
}
</style>
