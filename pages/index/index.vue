<template>
  <view class="container">
    <view class="stats-card card">
      <view class="stats-item">
        <text class="stats-value">{{ visibleTaskCount }}</text>
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
      <text class="risk-text">{{ riskReason() || '系统检测到异常身份关联，请联系后台处理' }}</text>
    </view>

    <view v-if="publishBlocked()" class="risk-panel">
      <text class="risk-title">当前账号为发单账号，仅可查看任务详情</text>
      <text class="risk-text">请到“我的发单”查看自己发布的任务和订单状态，不能在大厅接单。</text>
    </view>

    <view v-if="loadError" class="error-panel">
      <text class="error-title">加载失败</text>
      <text class="error-text">{{ loadError }}</text>
      <button class="btn-secondary" @click="retryLoad">重试</button>
    </view>

    <view class="task-list" v-if="!loading && visibleTaskList.length">
      <view
        class="task-card card"
        v-for="task in visibleTaskList"
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

    <view v-if="!loading && visibleTaskList.length && (loadingMore || taskHasMore)" class="load-more">
      <text v-if="loadingMore">加载更多中...</text>
      <text v-else>上拉加载更多</text>
    </view>

    <view v-if="!loading && visibleTaskList.length && !taskHasMore" class="load-more">
      <text>没有更多任务了</text>
    </view>

    <view v-if="!loading && visibleTaskList.length === 0" class="empty">
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

const IS_DEV = import.meta.env.DEV

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
      platformStorageKey: 'task-reward:last-platform',
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
    this.restorePlatformFilter()
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

  computed: {
    visibleTaskList() {
      return this.taskList.filter(task => !this.shouldHideTask(task))
    },

    visibleTaskCount() {
      return this.visibleTaskList.length
    }
  },

  methods: {
    sortTasksNewestFirst(list = []) {
      return [...list].sort((a, b) => {
        const aTime = new Date(a.created_at || a.createdAt || a.start_time || a.end_time || 0).getTime()
        const bTime = new Date(b.created_at || b.createdAt || b.start_time || b.end_time || 0).getTime()
        if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
          return bTime - aTime
        }
        return Number(b.id || 0) - Number(a.id || 0)
      })
    },

    filterTasksByPlatform(list = []) {
      if (!this.currentPlatform) {
        return list
      }
      return list.filter(task => String(task.platform || '') === this.currentPlatform)
    },

    async refreshData() {
      this.loadError = ''
      this.taskPage = 1
      this.taskHasMore = true
      if (IS_DEV) {
        this.applyMockData()
        this.loading = false
        this.loadingMore = false
        return
      }
      try {
        const taskLoaded = await this.loadTasks(true)
        const visibleTaskIds = this.taskList.map(task => String(task.id)).filter(Boolean)
        const hasToken = this.isLoggedIn()
        let statsLoaded = true
        let submissionsLoaded = true

        if (hasToken) {
          const [userLoaded, earningsLoaded, submissionLoaded] = await Promise.all([
            this.loadUserInfo(),
            this.loadUserStats(),
            this.loadMySubmissions(true, visibleTaskIds)
          ])
          statsLoaded = userLoaded && earningsLoaded
          submissionsLoaded = submissionLoaded
        } else {
          this.userInfo = {}
          this.totalEarnings = 0
          this.submissionMap = {}
        }

        if (!taskLoaded && !this.loadError) {
          this.loadError = '首页任务加载失败，请重试'
        } else if (hasToken && (!statsLoaded || !submissionsLoaded) && !this.loadError) {
          this.loadError = '部分数据加载失败，请稍后重试'
        }
      } catch (error) {
        console.error('刷新首页失败', error)
        this.loadError = this.loadError || '首页加载失败，请重试'
      }
    },

    async loadTasks(forceRefresh = false) {
      this.loading = true
      if (!forceRefresh) {
        this.loadingMore = true
      }
      try {
        const params = {
          page: this.taskPage,
          page_size: this.taskPageSize
        }
        if (this.currentPlatform) {
          params.platform = this.currentPlatform
        }
        const res = await getTaskList(params, { forceRefresh })
        const list = Array.isArray(res && res.list) ? res.list : []
        const normalizedList = this.filterTasksByPlatform(list)
        const nextTaskList = forceRefresh
          ? normalizedList
          : this.taskList.concat(normalizedList)

        this.taskList = this.sortTasksNewestFirst(nextTaskList)
        this.totalTasks = Number(res && (res.total ?? res.count)) || this.taskList.length
        const pageSize = Number(res && res.page_size) || this.taskPageSize
        const totalCount = Number(res && (res.total ?? res.count))
        if (Number.isFinite(totalCount)) {
          this.taskHasMore = this.taskList.length < totalCount
        } else {
          this.taskHasMore = normalizedList.length >= pageSize
        }
        this.taskPage += 1
        this.loading = false
        this.loadingMore = false
        return true
      } catch (error) {
        console.error('加载任务失败', error)
        this.loading = false
        this.loadingMore = false
        this.taskHasMore = false
        this.loadError = this.loadError || '首页任务加载失败，请重试'
        return false
      }
    },

    async loadUserStats() {
      try {
        if (!this.isLoggedIn()) {
          this.totalEarnings = 0
          return true
        }
        if (IS_DEV) {
          this.totalEarnings = 0
          return true
        }
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
        if (!this.isLoggedIn()) {
          this.userInfo = {}
          return true
        }
        if (IS_DEV) {
          const cached = uni.getStorageSync('userInfo')
          this.userInfo = cached
            ? (typeof cached === 'string' ? JSON.parse(cached) : cached)
            : {}
          return true
        }
        const res = await getUserInfo()
        this.userInfo = res || {}
        try {
          uni.setStorageSync('userInfo', this.userInfo)
        } catch (error) {}
        return true
      } catch (error) {
        console.error('加载用户信息失败', error)
        if (!this.isLoggedIn()) {
          this.userInfo = {}
          return true
        }
        return false
      }
    },

    async loadMySubmissions(forceRefresh = false, targetTaskIds = []) {
      try {
        if (IS_DEV) {
          this.submissionMap = {
            1: { task_id: 1, review_status: 0 },
            2: { task_id: 2, review_status: 2 }
          }
          return true
        }
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
      try {
        uni.setStorageSync(this.platformStorageKey, this.currentPlatform)
      } catch (error) {}
      this.refreshData(true)
    },

    restorePlatformFilter() {
      try {
        const saved = uni.getStorageSync(this.platformStorageKey)
        if (typeof saved === 'string' && this.platformTabs.some(tab => tab.value === saved)) {
          this.currentPlatform = saved
        }
      } catch (error) {}
    },

    riskBlocked() {
      return Number(this.userInfo?.risk_status) === 1
    },

    riskReason() {
      return this.userInfo?.risk_reason || ''
    },

    publishBlocked() {
      return Number(this.userInfo?.publish_permission || 0) === 1
    },

    shouldHideTask(task) {
      const submission = this.submissionMap[String(task?.id)]
      return Number(submission?.review_status) === 1
    },

    isLoggedIn() {
      try {
        return Boolean(uni.getStorageSync('token'))
      } catch (error) {
        return false
      }
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

    acceptNotStarted(task) {
      const startTime = task?.accept_start_time_raw || task?.accept_start_time || task?.start_time_raw || task?.start_time
      if (!startTime) {
        return false
      }
      return new Date(startTime).getTime() > Date.now()
    },

    taskActionText(task) {
      if (!this.isLoggedIn()) {
        return '去登录'
      }
      if (this.publishBlocked()) {
        return '仅查看详情'
      }
      if (this.riskBlocked()) {
        return '禁止接单'
      }
      const submission = this.submissionMap[String(task.id)]
      if (!submission) {
        if (this.acceptNotStarted(task)) {
          return '待接单'
        }
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
    },

    getMockTasks() {
      return [
        {
          id: 1,
          title: '抖音浏览任务',
          platform: 'douyin',
          reward_amount: 3.2,
          search_keyword: '任务返现',
          remaining_quota: 5,
          total_quota: 20,
          used_quota: 15,
          end_time: new Date(Date.now() + 86400000).toISOString()
        },
        {
          id: 2,
          title: '淘宝收藏任务',
          platform: 'taobao',
          reward_amount: 2.8,
          search_keyword: '精选好物',
          remaining_quota: 3,
          total_quota: 10,
          used_quota: 7,
          end_time: new Date(Date.now() + 172800000).toISOString()
        }
      ]
    },

    applyMockData() {
      this.userInfo = {
        nickname: '测试用户',
        risk_status: 0,
        total_earnings: 0,
        available_balance: 0,
        frozen_balance: 0
      }
      this.taskList = this.sortTasksNewestFirst(this.filterTasksByPlatform(this.getMockTasks()))
      this.totalTasks = this.taskList.length
      this.totalEarnings = 0
      this.submissionMap = {
        1: { task_id: 1, review_status: 0 },
        2: { task_id: 2, review_status: 2 }
      }
      this.totalTasks = this.visibleTaskCount
      this.loading = false
      this.loadingMore = false
      this.hasLoadedData = true
    }
  }
}
</script>

<style scoped>
.stats-card {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 20rpx;
  padding: 28rpx;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(6, 182, 212, 0.92));
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
  background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
  color: #fff;
  box-shadow: 0 10rpx 24rpx rgba(37, 99, 235, 0.18);
}

.stats-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1 1 calc(50% - 10rpx);
  min-width: 0;
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
  display: flex;
  flex-direction: column;
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
  width: 100%;
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
  box-shadow: 0 10rpx 20rpx rgba(37, 99, 235, 0.18);
  background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
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
  background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
  box-shadow: 0 12rpx 24rpx rgba(37, 99, 235, 0.22);
  color: #fff;
}

.stats-visual {
  width: 100%;
  height: 170rpx;
  margin-top: 6rpx;
  flex: 0 0 100%;
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


