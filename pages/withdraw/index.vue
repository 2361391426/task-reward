<template>
  <view class="page">
    <view class="summary card">
      <view class="summary-item">
        <text class="summary-label">可用积分</text>
        <text class="summary-value">{{ availableBalance }}积分</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-label">待确认积分</text>
        <text class="summary-value muted">{{ frozenBalance }}积分</text>
      </view>
    </view>

    <view class="notice card">
      <text class="notice-title">积分说明</text>
      <text class="notice-text">积分仅用于活动体验记录，不等同现金，不提供用户自行发起线上资金操作入口。</text>
      <text class="notice-text">审核通过后的积分会进入记录，具体权益与结算以平台活动规则为准。</text>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">积分记录</text>
      </view>

      <view class="record-list" v-if="withdrawalList.length">
        <view class="record-item card" v-for="item in withdrawalList" :key="item.id">
          <view class="record-top">
            <text class="record-amount">{{ item.amount }}积分</text>
            <view class="status-badge" :class="'status-' + item.status">
              {{ statusText(item.status) }}
            </view>
          </view>
          <text class="record-text">确认积分：{{ item.actual_amount || 0 }}积分</text>
          <text class="record-text">记录时间：{{ formatTime(item.created_at) }}</text>
          <text class="record-text error" v-if="item.reject_reason">说明：{{ item.reject_reason }}</text>
        </view>
      </view>

      <view class="load-more" v-if="withdrawalList.length && (withdrawalHasMore || loadingMoreRecords)">
        <text>{{ loadingMoreRecords ? '加载中...' : '上拉加载更多' }}</text>
      </view>

      <view class="load-more" v-else-if="withdrawalList.length && !withdrawalHasMore">
        <text>没有更多记录了</text>
      </view>

      <view v-else class="empty-state">
        <image class="empty-illustration" src="/static/images/hero-wallet.png" mode="aspectFit" />
        <text>暂无积分记录</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getEarnings, getWithdrawals } from '../../api/user.js'
import { formatTime, withdrawalStatusText } from '../../utils/format.js'

export default {
  data() {
    return {
      loadingRecords: false,
      loadingMoreRecords: false,
      earnings: {},
      withdrawalList: [],
      withdrawalPage: 1,
      withdrawalPageSize: 10,
      withdrawalHasMore: true
    }
  },

  computed: {
    availableBalance() {
      return Number(this.earnings.available_balance || 0)
    },

    frozenBalance() {
      return Number(this.earnings.frozen_balance || 0)
    }
  },

  onShow() {
    this.loadData(true)
  },

  async onPullDownRefresh() {
    try {
      await this.loadData(true)
    } finally {
      uni.stopPullDownRefresh()
    }
  },

  onReachBottom() {
    this.loadMoreRecords()
  },

  methods: {
    async loadData(reset = false) {
      if (reset) {
        this.withdrawalPage = 1
        this.withdrawalHasMore = true
        this.withdrawalList = []
        this.loadingRecords = true
      } else {
        if (!this.withdrawalHasMore || this.loadingRecords || this.loadingMoreRecords) {
          return
        }
        this.loadingMoreRecords = true
      }

      const page = reset ? 1 : this.withdrawalPage
      const pageSize = this.withdrawalPageSize

      try {
        const [earningsRes, withdrawalsRes] = await Promise.all([
          getEarnings(),
          getWithdrawals({ page, page_size: pageSize })
        ])
        this.earnings = earningsRes || {}
        const list = Array.isArray(withdrawalsRes && withdrawalsRes.list) ? withdrawalsRes.list : []
        const total = withdrawalsRes && typeof withdrawalsRes.total === 'number'
          ? withdrawalsRes.total
          : (reset ? list.length : this.withdrawalList.length + list.length)
        const returnedPageSize = withdrawalsRes && typeof withdrawalsRes.page_size === 'number'
          ? withdrawalsRes.page_size
          : pageSize

        this.withdrawalList = reset ? list : this.withdrawalList.concat(list)
        this.withdrawalPage = page + 1
        this.withdrawalHasMore = this.withdrawalList.length < total && list.length >= returnedPageSize
      } catch (error) {
        console.error('加载积分记录失败', error)
        uni.showToast({ title: '加载积分记录失败', icon: 'none' })
      } finally {
        this.loadingRecords = false
        this.loadingMoreRecords = false
      }
    },

    loadMoreRecords() {
      if (!this.withdrawalHasMore || this.loadingRecords || this.loadingMoreRecords) {
        return
      }
      this.loadData(false)
    },

    statusText(status) {
      return withdrawalStatusText(status)
    },

    formatTime(time) {
      return formatTime(time)
    }
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.summary {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 20rpx;
}

.summary-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.summary-divider {
  width: 1rpx;
  background: #e2e8f0;
}

.summary-label {
  font-size: 24rpx;
  color: #64748b;
}

.summary-value {
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}

.summary-value.muted {
  color: #334155;
}

.notice {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.notice-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.notice-text {
  font-size: 25rpx;
  line-height: 1.7;
  color: #64748b;
}

.section {
  margin-top: 12rpx;
}

.section-header {
  margin-bottom: 16rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.record-item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.record-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.record-amount {
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
}

.record-text {
  font-size: 24rpx;
  color: #64748b;
}

.record-text.error {
  color: #ef4444;
}

.status-badge {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.status-0 {
  background: #fff7ed;
  color: #c2410c;
}

.status-1 {
  background: #ecfdf5;
  color: #166534;
}

.status-2 {
  background: #fef2f2;
  color: #b91c1c;
}

.load-more,
.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24rpx 0;
  color: #64748b;
  font-size: 26rpx;
}

.empty-illustration {
  width: 180rpx;
  height: 180rpx;
  margin-bottom: 12rpx;
}
</style>
