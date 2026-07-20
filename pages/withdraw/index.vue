<template>
  <view class="page">
    <view class="summary card">
      <view class="summary-item">
        <text class="summary-label">可用积分</text>
        <text class="summary-value">{{ availableBalance }}积分</text>
      </view>
      <view class="summary-divider"></view>
      <view class="summary-item">
        <text class="summary-label">冻结积分</text>
        <text class="summary-value muted">{{ earnings.frozen_balance || 0 }}积分</text>
      </view>
    </view>

    <view class="card form-card">
      <view class="form-item">
        <text class="form-label">兑换积分</text>
        <input
          v-model="form.amount"
          type="digit"
          class="form-input"
          placeholder="请输入要兑换的积分"
        />
      </view>

      <view class="form-item">
        <text class="form-label">兑换方式</text>
        <picker :range="withdrawTypes" range-key="label" @change="handleTypeChange">
          <view class="picker-value">{{ currentWithdrawType.label }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="form-label">接收账号</text>
        <input
          v-model="form.account_info"
          class="form-input"
          placeholder="请输入微信号或支付宝账号"
        />
      </view>

      <button class="btn-primary submit-btn" :loading="submitting" :disabled="submitting || !canSubmit" @click="submit">
        提交兑换申请
      </button>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">兑换记录</text>
      </view>

      <view class="record-list" v-if="withdrawalList.length">
        <view class="record-item card" v-for="item in withdrawalList" :key="item.id">
          <view class="record-top">
            <text class="record-amount">{{ item.amount }}积分</text>
            <view class="status-badge" :class="'status-' + item.status">
              {{ statusText(item.status) }}
            </view>
          </view>
          <text class="record-text">实际兑换：{{ item.actual_amount || 0 }}积分</text>
          <text class="record-text">服务费：{{ item.fee || 0 }}积分</text>
          <text class="record-text">账号：{{ item.account_info || '-' }}</text>
          <text class="record-text">时间：{{ formatTime(item.created_at) }}</text>
          <text class="record-text error" v-if="item.reject_reason">原因：{{ item.reject_reason }}</text>
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
        <text>暂无兑换记录</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getEarnings, getWithdrawals, submitWithdrawal, invalidateUserCache } from '../../api/user.js'
import { formatTime, withdrawalStatusText } from '../../utils/format.js'
import { createDraftScheduler } from '../../utils/draft.js'

export default {
  data() {
    return {
      submitting: false,
      loadingRecords: false,
      loadingMoreRecords: false,
      earnings: {},
      withdrawalList: [],
      withdrawalPage: 1,
      withdrawalPageSize: 10,
      withdrawalHasMore: true,
      withdrawTypes: [
        { label: '微信', value: 1 },
        { label: '支付宝', value: 2 }
      ],
      currentWithdrawType: { label: '微信', value: 1 },
      form: {
        amount: '',
        withdraw_type: 1,
        account_info: ''
      }
    }
  },

  created() {
    this.draftScheduler = createDraftScheduler(() => this.saveDraft(), 400)
  },

  computed: {
    draftKey() {
      let userId = 'guest'
      try {
        const userInfo = uni.getStorageSync('userInfo')
        if (userInfo) {
          const parsed = typeof userInfo === 'string' ? JSON.parse(userInfo) : userInfo
          userId = parsed?.id ? String(parsed.id) : userId
        }
      } catch (error) {
        console.error('解析兑换草稿范围失败', error)
      }
      return `task-reward:withdraw-draft:${userId}`
    },

    availableBalance() {
      return Number(this.earnings.available_balance || 0)
    },

    canSubmit() {
      const amount = Number(this.form.amount)
      const account = this.form.account_info.trim()
      return amount > 0 && amount <= this.availableBalance && account.length > 0
    }
  },

  watch: {
    form: {
      deep: true,
      handler() {
        this.scheduleSaveDraft()
      }
    }
  },

  onShow() {
    this.loadDraft()
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

  onHide() {
    this.flushDraftSave()
  },

  onUnload() {
    this.flushDraftSave()
  },

  methods: {
    buildDraftPayload() {
      return {
        amount: this.form.amount,
        withdraw_type: this.form.withdraw_type,
        account_info: this.form.account_info
      }
    },

    applyDraft(draft) {
      if (!draft) return false

      this.form.amount = draft.amount || ''
      this.form.account_info = draft.account_info || ''

      const draftType = Number(draft.withdraw_type)
      const matchedType = this.withdrawTypes.find(type => type.value === draftType) || this.withdrawTypes[0]
      this.currentWithdrawType = matchedType
      this.form.withdraw_type = matchedType.value
      return true
    },

    loadDraft() {
      try {
        const raw = uni.getStorageSync(this.draftKey)
        if (!raw) return false
        const draft = typeof raw === 'string' ? JSON.parse(raw) : raw
        return this.applyDraft(draft)
      } catch (error) {
        console.error('加载兑换草稿失败', error)
        return false
      }
    },

    saveDraft() {
      try {
        uni.setStorageSync(this.draftKey, JSON.stringify(this.buildDraftPayload()))
      } catch (error) {
        console.error('保存兑换草稿失败', error)
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
        console.error('清理兑换草稿失败', error)
      }
    },

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
        console.error('加载兑换数据失败', error)
        uni.showToast({ title: '加载兑换数据失败', icon: 'none' })
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

    handleTypeChange(event) {
      const index = Number(event.detail.value)
      const type = this.withdrawTypes[index]
      if (!type) return
      this.currentWithdrawType = type
      this.form.withdraw_type = type.value
      this.saveDraft()
    },

    async submit() {
      const amount = Number(this.form.amount)
      if (!amount || amount <= 0) {
        uni.showToast({ title: '请输入有效积分', icon: 'none' })
        return
      }

      if (amount > this.availableBalance) {
        uni.showToast({ title: '兑换积分不能超过可用积分', icon: 'none' })
        return
      }

      if (!this.form.account_info.trim()) {
        uni.showToast({ title: '请输入接收账号', icon: 'none' })
        return
      }

      try {
        this.submitting = true
        await submitWithdrawal({
          amount,
          withdraw_type: this.form.withdraw_type,
          account_info: this.form.account_info.trim()
        })
        invalidateUserCache()
        uni.showToast({ title: '兑换申请已提交', icon: 'success' })
        this.form.amount = ''
        this.form.account_info = ''
        this.clearDraft()
        await this.loadData(true)
      } catch (error) {
        console.error('提交兑换失败', error)
        uni.showToast({ title: '提交失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
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

.form-card {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.form-label {
  font-size: 28rpx;
  color: #334155;
}

.form-input {
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 14rpx;
  height: 88rpx;
  padding: 0 22rpx;
  font-size: 28rpx;
  color: #111827;
}

.picker-value {
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 14rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  padding: 0 22rpx;
  font-size: 28rpx;
  color: #111827;
}

.submit-btn {
  margin-top: 6rpx;
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
