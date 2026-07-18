<template>
  <view class="container order-page">
    <template v-if="publishMode">
      <view class="page-header">
        <text class="page-title">我的发单</text>
      </view>

      <view class="summary-card card">
        <uni-icons class="summary-icon" type="list" color="#409eff" size="30" />
        <view class="summary-main">
          <text class="summary-title">{{ publishSummaryTitle }}</text>
          <text class="summary-subtitle">{{ publishSummarySubtitle }}</text>
        </view>
        <view class="summary-badge">{{ publishCurrentTabLabel }}</view>
      </view>

      <view class="task-tabs">
        <view
          v-for="(tab, index) in publishTabs"
          :key="tab.key"
          class="tab-item"
          :class="{ active: publishCurrentTab === index }"
          @click="switchPublishTab(index)"
        >
          <uni-icons class="tab-icon" :type="tab.iconType" :color="tab.iconColor" size="20" />
          <text>{{ tab.label }}</text>
          <text class="tab-count" v-if="tab.count > 0">{{ tab.count }}</text>
        </view>
      </view>

      <view v-if="loadError" class="error-panel">
        <text class="error-title">加载失败</text>
        <text class="error-text">{{ loadError }}</text>
        <button class="btn-secondary" @click="retryLoad">重试</button>
      </view>

      <view class="submission-list" v-if="!loading">
        <view
          v-for="item in filteredPublishList"
          :key="item.id"
          class="submission-item card"
          @click="viewPublishTask(item)"
        >
          <view class="item-header">
            <view class="item-title-wrap">
              <text class="item-title">{{ item.title }}</text>
              <text class="item-platform">{{ platformText(item.platform) }}</text>
            </view>
            <view class="status-stack">
              <text class="status-badge status-publish" :class="'publish-' + item.publication_status_tag_type">
                {{ item.publication_status_text }}
              </text>
              <text class="status-badge status-accept" :class="'accept-' + item.accept_status_tag_type">
                {{ item.accept_status_text }}
              </text>
            </view>
          </view>

          <view class="item-info">
            <text class="info-text">发布时间: {{ formatTime(item.start_time_raw || item.created_at) }}</text>
            <text class="info-text">结束时间: {{ formatTime(item.end_time_raw || item.end_time) }}</text>
            <text class="info-text">名额: {{ item.remaining_quota }}/{{ item.total_quota }}</text>
            <text class="info-text">奖励金额: ¥{{ item.reward_amount }}</text>
            <text class="info-text">接单数: {{ Number(item.submission_count || 0) }}</text>
            <text class="info-text">审核中/通过/驳回: {{ Number(item.pending_review || 0) }}/{{ Number(item.approved || 0) }}/{{ Number(item.rejected || 0) }}</text>
          </view>
        </view>

        <view v-if="filteredPublishList.length === 0" class="empty">
          <text>暂无任务发布</text>
        </view>
      </view>

      <view v-else class="empty">
        <text>加载中...</text>
      </view>
    </template>

    <template v-else>
    <view class="page-header">
      <text class="page-title">{{ pageTitle }}</text>
    </view>

    <view class="summary-card card">
      <uni-icons class="summary-icon" type="list" color="#409eff" size="30" />
      <view class="summary-main">
        <text class="summary-title">{{ summaryTitle }}</text>
        <text class="summary-subtitle">{{ summarySubtitle }}</text>
      </view>
      <view class="summary-badge">{{ currentTabLabel }}</view>
    </view>

    <view class="task-tabs">
      <view
        v-for="(tab, index) in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: currentTab === index }"
        @click="switchTab(index)"
      >
        <uni-icons class="tab-icon" :type="tab.iconType" :color="tab.iconColor" size="20" />
        <text>{{ tab.label }}</text>
        <text class="tab-count" v-if="tab.count > 0">{{ tab.count }}</text>
      </view>
    </view>

    <view v-if="loadError" class="error-panel">
      <text class="error-title">加载失败</text>
      <text class="error-text">{{ loadError }}</text>
      <button class="btn-secondary" @click="retryLoad">重试</button>
    </view>

    <view class="submission-list" v-if="!loading">
      <view
        v-for="item in filteredList"
        :key="item.id"
        class="submission-item card"
        @click="viewSubmission(item)"
      >
        <view class="item-header">
          <view class="item-title-wrap">
            <text class="item-title">{{ item.task_title }}</text>
            <text class="item-platform">{{ platformText(item.platform) }}</text>
          </view>
          <view class="status-badge" :class="getStatusClass(item)">
            {{ getStatusText(item) }}
          </view>
        </view>

        <view class="item-info">
          <text class="info-text">提交时间: {{ formatTime(item.submit_time) }}</text>
          <text class="info-text">实付金额: ¥{{ item.paid_amount || 0 }}</text>
          <text class="info-text">返现金额: ¥{{ item.reward_amount || 0 }}</text>
        </view>

        <view class="item-note" v-if="item.review_note">
          <text class="note-label">审核备注:</text>
          <text class="note-text">{{ item.review_note }}</text>
        </view>

        <view class="item-actions" @click.stop>
          <button class="action-btn ghost" @click="viewSubmission(item)">查看详情</button>
          <button
            v-if="merchantMode && Number(item.review_status) === 0"
            class="action-btn primary"
            @click="reviewSubmission(item, 1)"
          >
            通过
          </button>
          <button
            v-if="merchantMode && Number(item.review_status) === 0"
            class="action-btn danger"
            @click="reviewSubmission(item, 2)"
          >
            驳回
          </button>
          <button
            v-if="isEditableInProgress(item)"
            class="action-btn primary"
            @click="editSubmission(item)"
          >
            编辑
          </button>
          <button
            v-if="Number(item.review_status) === 2"
            class="action-btn primary"
            @click="resubmitSubmission(item)"
          >
            重新提交
          </button>
        </view>
      </view>

      <view v-if="filteredList.length === 0" class="empty">
        <image class="empty-illustration" src="/static/images/empty-submission.png" mode="aspectFit" />
        <text>暂无记录</text>
      </view>
    </view>

    <view v-else class="empty">
      <text>加载中...</text>
    </view>
    </template>
  </view>
</template>

<script>
import { getMySubmissions, getTaskList } from '../../api/task.js'
import { getMerchantSubmissions, getMerchantTasks, reviewMerchantSubmission } from '../../api/merchant.js'
import { formatTime, platformText, submissionStatusText } from '../../utils/format.js'
import { clearStartedTaskDraft, mergeStartedTaskDrafts, readStartedTaskDrafts } from '../../utils/started-task-draft.js'
import { isMerchantSession } from '../../utils/session.js'

export default {
  data() {
    return {
      loading: false,
      loadError: '',
      currentTab: 0,
      tabs: [
        { key: 'all', label: '全部订单', status: null, count: 0, iconType: 'list', iconColor: '#409eff' },
        { key: 'pending', label: '待审核', status: 0, count: 0, iconType: 'redo', iconColor: '#e6a23c' },
        { key: 'approved', label: '已通过', status: 1, count: 0, iconType: 'checkbox-filled', iconColor: '#67c23a' },
        { key: 'rejected', label: '已驳回', status: 2, count: 0, iconType: 'closeempty', iconColor: '#f56c6c' },
        { key: 'in_progress', label: '进行中', status: -1, count: 0, iconType: 'refresh', iconColor: '#67c23a' }
      ],
      allList: [],
      filteredList: [],
      initialStatus: 'all',
      merchantMode: false,
      publishMode: false,
      publishLoading: false,
      publishFilterKey: 'all',
      publishTasks: [],
      publishTabs: [
        { key: 'all', label: '全部订单', status: 'all', count: 0, iconType: 'list', iconColor: '#409eff' },
        { key: 'publish_pending', label: '待接单', status: 'publish_pending', count: 0, iconType: 'redo', iconColor: '#e6a23c' },
        { key: 'publish_progress', label: '进行中', status: 'publish_progress', count: 0, iconType: 'refresh', iconColor: '#67c23a' },
        { key: 'publish_completed', label: '已完成', status: 'publish_completed', count: 0, iconType: 'checkbox-filled', iconColor: '#67c23a' },
        { key: 'publish_cancelled', label: '已撤销', status: 'publish_cancelled', count: 0, iconType: 'closeempty', iconColor: '#f56c6c' }
      ]
    }
  },

  computed: {
    currentTabLabel() {
      return this.tabs[this.currentTab]?.label || '全部订单'
    },

    pageTitle() {
      return this.merchantMode ? '审核中心' : '我的接单'
    },

    summaryTitle() {
      return this.merchantMode ? '手机端审核' : '接单记录'
    },

    summarySubtitle() {
      return this.merchantMode
        ? '可直接审核发出去的单并同步后台，待审单优先展示'
        : '查看全部订单、审核状态和重新提交入口'
    },

    publishCurrentTabLabel() {
      return this.publishTabs[this.publishCurrentTab]?.label || '全部订单'
    },

    publishSummaryTitle() {
      return '任务发布记录'
    },

    publishSummarySubtitle() {
      return '点击任务可查看详情，发单账号仅同步状态不参与接单'
    },

    publishCurrentTab() {
      const index = this.publishTabs.findIndex(tab => tab.key === this.publishFilterKey)
      return index >= 0 ? index : 0
    },

    filteredPublishList() {
      if (!this.publishMode) return []
      const list = Array.isArray(this.publishTasks) ? [...this.publishTasks] : []
      const sorted = list.sort((a, b) => {
        const aTime = new Date(a.created_at || a.start_time_raw || 0).getTime()
        const bTime = new Date(b.created_at || b.start_time_raw || 0).getTime()
        return bTime - aTime
      })
      switch (this.publishFilterKey) {
        case 'publish_pending':
          return sorted.filter(item => item.publication_status === 'pending' || item.accept_status === 'accept_pending')
        case 'publish_progress':
          return sorted.filter(item => item.publication_status === 'published' && item.accept_status === 'accept_open')
        case 'publish_completed':
          return sorted.filter(item => item.publication_status === 'ended')
        case 'publish_cancelled':
          return sorted.filter(item => item.publication_status === 'paused')
        default:
          return sorted
      }
    }
  },

  onLoad(options) {
    this.merchantMode = isMerchantSession()
    this.publishMode = String(options?.kind || '') === 'publish'
    this.publishFilterKey = String(options?.filter || options?.status || 'all')
    const status = String(options?.status || 'all')
    this.initialStatus = status
    const tabIndex = this.tabs.findIndex(tab => tab.key === status)
    this.currentTab = tabIndex >= 0 ? tabIndex : 0
    this.updateNavigationTitle()
    this.refreshData(true)
  },

  onShow() {
    this.updateNavigationTitle()
  },

  async onPullDownRefresh() {
    try {
      await this.refreshData(true)
    } finally {
      uni.stopPullDownRefresh()
    }
  },

  methods: {
    async refreshData(forceRefresh = false) {
      this.loadError = ''
      this.loading = true
      try {
        if (this.publishMode) {
          await this.refreshPublishData(forceRefresh)
          return
        }

        const pageSize = 50

        const loadAllPages = async (loader) => {
          const rows = []
          let page = 1
          let hasMore = true

          while (hasMore) {
            const res = await loader(page, pageSize)
            const pageList = Array.isArray(res && res.list) ? res.list : []
            rows.push(...pageList)
            const total = res && typeof res.total === 'number' ? res.total : rows.length
            const returnedPageSize = res && typeof res.page_size === 'number' ? res.page_size : pageSize
            hasMore = rows.length < total && pageList.length >= returnedPageSize
            page += 1
          }

          return rows
        }

        const rows = this.merchantMode
          ? await loadAllPages((page, pageSizeValue) => getMerchantSubmissions({ page, page_size: pageSizeValue }))
          : await loadAllPages((page, pageSizeValue) => getMySubmissions(
              { page, page_size: pageSizeValue },
              { forceRefresh: forceRefresh && page === 1 }
            ))

        this.allList = rows
        if (!this.merchantMode) {
          this.pruneStartedDrafts(rows)
          this.allList = mergeStartedTaskDrafts(this.allList)
        }
        this.updateCounts()
        this.applyFilter()
      } catch (error) {
        console.error('加载接单记录失败', error)
        this.loadError = '接单记录加载失败，请重试'
      } finally {
        this.loading = false
      }
    },

    async refreshPublishData(forceRefresh = false) {
      this.publishLoading = true
      try {
        if (!this.merchantMode) {
          this.loadError = '请联系管理员开通权限'
          this.publishTasks = []
          return
        }

        const pageSize = 50
        const loadAllPages = async (loader) => {
          const rows = []
          let page = 1
          let hasMore = true

          while (hasMore) {
            const res = await loader(page, pageSize)
            const pageList = Array.isArray(res && res.list) ? res.list : []
            rows.push(...pageList)
            const total = res && typeof res.total === 'number' ? res.total : rows.length
            const returnedPageSize = res && typeof res.page_size === 'number' ? res.page_size : pageSize
            hasMore = rows.length < total && pageList.length >= returnedPageSize
            page += 1
          }

          return rows
        }

        this.publishTasks = await loadAllPages((page, pageSizeValue) => {
          return getMerchantTasks({ page, page_size: pageSizeValue })
        })
        this.updatePublishCounts()
      } catch (error) {
        console.error('加载任务发布记录失败', error)
        this.loadError = '任务发布记录加载失败，请重试'
        this.publishTasks = []
      } finally {
        this.publishLoading = false
      }
    },

    updateNavigationTitle() {
      uni.setNavigationBarTitle({
        title: this.publishMode ? '我的发单' : (this.merchantMode ? '审核中心' : '我的接单')
      })
    },

    updatePublishCounts() {
      this.publishTabs[0].count = this.publishTasks.length
      this.publishTabs[1].count = this.publishTasks.filter(item => item.publication_status === 'pending' || item.accept_status === 'accept_pending').length
      this.publishTabs[2].count = this.publishTasks.filter(item => item.publication_status === 'published' && item.accept_status === 'accept_open').length
      this.publishTabs[3].count = this.publishTasks.filter(item => item.publication_status === 'ended').length
      this.publishTabs[4].count = this.publishTasks.filter(item => item.publication_status === 'paused').length
    },

    updateCounts() {
      this.tabs[0].count = this.allList.length
      this.tabs[1].count = this.allList.filter(item => Number(item.review_status) === 0).length
      this.tabs[2].count = this.allList.filter(item => Number(item.review_status) === 1).length
      this.tabs[3].count = this.allList.filter(item => Number(item.review_status) === 2).length
      this.tabs[4].count = this.allList.filter(item => this.isDraftItem(item)).length
    },

    applyFilter() {
      const tab = this.tabs[this.currentTab]
      this.filteredList = tab.status === null
        ? this.allList
        : tab.key === 'in_progress'
          ? this.allList.filter(item => this.isDraftItem(item))
          : this.allList.filter(item => Number(item.review_status) === Number(tab.status))
    },

    switchTab(index) {
      this.currentTab = index
      this.applyFilter()
    },

    switchPublishTab(index) {
      this.publishFilterKey = this.publishTabs[index]?.key || 'all'
    },

    viewSubmission(item) {
      if (!item?.id) {
        uni.showToast({ title: '记录缺失', icon: 'none' })
        return
      }
      if (item.local_draft) {
        this.editSubmission(item)
        return
      }
      uni.navigateTo({
        url: `/pages/submission-detail/index?id=${item.id}`
      })
    },

    isEditableInProgress(item) {
      return Boolean(item && (item.local_draft || Number(item.review_status) === -1 || item.draft_status === 'in_progress'))
    },

    editSubmission(item) {
      if (!item?.task_id) {
        uni.showToast({ title: '任务缺失', icon: 'none' })
        return
      }
      const submissionId = item.id && String(item.id).startsWith('draft-') ? '' : item.id
      uni.navigateTo({
        url: submissionId
          ? `/pages/upload/index?taskId=${item.task_id}&submissionId=${submissionId}`
          : `/pages/upload/index?taskId=${item.task_id}`
      })
    },

    resubmitSubmission(item) {
      if (!item?.task_id || !item?.id) {
        uni.showToast({ title: '记录缺失', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/upload/index?taskId=${item.task_id}&submissionId=${item.id}`
      })
    },

    async reviewSubmission(item, reviewStatus) {
      if (!this.merchantMode) {
        uni.showToast({ title: '当前账号没有审核权限', icon: 'none' })
        return
      }

      const nextStatus = Number(reviewStatus)
      if (!item?.id || ![1, 2].includes(nextStatus)) {
        uni.showToast({ title: '审核参数无效', icon: 'none' })
        return
      }

      try {
        const confirmed = await new Promise((resolve) => {
          uni.showModal({
            title: nextStatus === 1 ? '确认通过' : '确认驳回',
            content: nextStatus === 1
              ? '确认将该提交审核通过并同步到后端吗？'
              : '确认驳回该提交吗？系统将使用默认驳回原因同步到后端。',
            confirmText: '确认',
            cancelText: '取消',
            success: (result) => resolve(Boolean(result?.confirm)),
            fail: () => resolve(false)
          })
        })

        if (!confirmed) {
          return
        }

        await reviewMerchantSubmission({
          id: item.id,
          review_status: nextStatus,
          reject_reason: nextStatus === 2 ? '审核未通过，请补充截图后重新提交' : ''
        })
        uni.showToast({ title: nextStatus === 1 ? '已通过' : '已驳回', icon: 'success' })
        await this.refreshData(true)
      } catch (error) {
        console.error('提交审核失败', error)
        uni.showToast({ title: error?.message || '审核失败，请重试', icon: 'none' })
      }
    },

    getSubmissionStatusText(status) {
      return submissionStatusText(status)
    },

    formatTime(time) {
      return formatTime(time)
    },

    platformText(platform) {
      return platformText(platform)
    },

    retryLoad() {
      this.refreshData(true)
    },

    viewPublishTask(item) {
      if (!item || !item.id) {
        uni.showToast({ title: '任务数据缺失', icon: 'none' })
        return
      }
      uni.navigateTo({
        url: `/pages/task-detail/index?id=${item.id}`
      })
    },

    isDraftItem(item) {
      return Boolean(item && (item.local_draft || Number(item.review_status) === -1 || item.draft_status === 'in_progress'))
    },

    getStatusText(item) {
      if (this.isDraftItem(item)) {
        return '进行中'
      }
      return submissionStatusText(item.review_status)
    },

    getStatusClass(item) {
      if (this.isDraftItem(item)) {
        return 'status-draft'
      }
      return `status-${Number(item.review_status)}`
    },

    pruneStartedDrafts(serverRows = []) {
      const serverTaskIds = new Set((serverRows || []).map(item => String(item.task_id)).filter(Boolean))
      const drafts = readStartedTaskDrafts()
      drafts.forEach((draft) => {
        if (serverTaskIds.has(String(draft.task_id))) {
          clearStartedTaskDraft(draft.task_id)
        }
      })
    }
  }
}
</script>

<style scoped>
.order-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 40rpx;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f8fbff 0%, #f6f8fc 50%, #f7f8fc 100%);
}

.page-header {
  display: flex;
  justify-content: center;
  margin-bottom: 24rpx;
}

.page-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}

.summary-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
  background: #fff;
}

.summary-icon {
  width: 72rpx;
  height: 72rpx;
  flex-shrink: 0;
}

.summary-main {
  flex: 1;
}

.summary-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.summary-subtitle {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #64748b;
}

.summary-badge {
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: #eff6ff;
  color: #2563eb;
  font-size: 22rpx;
}

.task-tabs {
  display: flex;
  gap: 10rpx;
  padding: 10rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.75);
  margin-bottom: 20rpx;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 10rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  color: #475569;
  position: relative;
}

.tab-icon {
  width: 34rpx;
  height: 34rpx;
  display: block;
  margin: 0 auto 8rpx;
}

.tab-item.active {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(6, 182, 212, 0.9));
  color: #fff;
}

.tab-count {
  position: absolute;
  top: 6rpx;
  right: 8rpx;
  background: #ff4d4f;
  color: #fff;
  border-radius: 999rpx;
  padding: 0 8rpx;
  font-size: 18rpx;
}

.submission-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.submission-item {
  margin: 0;
  padding: 24rpx 20rpx;
  background: #fff;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.item-title-wrap {
  flex: 1;
}

.item-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.item-platform {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #64748b;
}

.status-badge {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  white-space: nowrap;
}

.status-0 {
  background: #fef3c7;
  color: #92400e;
}

.status-1 {
  background: #dcfce7;
  color: #166534;
}

.status-2 {
  background: #fee2e2;
  color: #b91c1c;
}

.status-draft {
  background: #e0f2fe;
  color: #0369a1;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.info-text {
  font-size: 24rpx;
  color: #475569;
}

.item-note {
  margin-top: 14rpx;
  padding: 14rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.note-label {
  display: block;
  margin-bottom: 6rpx;
  font-size: 22rpx;
  color: #94a3b8;
}

.note-text {
  font-size: 24rpx;
  color: #374151;
  line-height: 1.5;
}

.item-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 16rpx;
}

.action-btn {
  flex: 1;
  height: 74rpx;
  line-height: 74rpx;
  border-radius: 16rpx;
  font-size: 24rpx;
  border: 1rpx solid #dbe2ea;
  background: #fff;
}

.action-btn.primary {
  background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
  color: #fff;
  border-color: transparent;
}

.action-btn.danger {
  background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
  color: #fff;
  border-color: transparent;
}

.action-btn.ghost {
  color: #334155;
}

.empty {
  text-align: center;
  padding: 80rpx 0;
  color: #94a3b8;
  font-size: 26rpx;
}

.empty-illustration {
  width: 260rpx;
  height: 160rpx;
  margin: 0 auto 18rpx;
}
</style>




