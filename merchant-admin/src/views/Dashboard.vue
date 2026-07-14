<template>
  <div class="dashboard">
    <el-alert
      v-if="lowBalanceWarning"
      type="warning"
      show-icon
      :closable="false"
      title="商家余额偏低，创建新任务前请先确认账户余额是否充足。"
      style="margin-bottom: 20px;"
    />

    <el-row :gutter="20">
      <el-col v-for="card in statCards" :key="card.label" :xs="24" :sm="12" :lg="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" :style="{ background: card.color }">
              <el-icon size="32">
                <component :is="card.icon" />
              </el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ card.value }}</div>
              <div class="stat-label">{{ card.label }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col v-for="item in balanceCards" :key="item.label" :xs="24" :sm="8">
        <el-card class="mini-card">
          <div class="mini-label">{{ item.label }}</div>
          <div class="mini-value">{{ item.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="recent-submissions" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>平台月度实付统计</span>
          <span>{{ monthKey }}</span>
        </div>
      </template>

      <div ref="chartRef" class="chart-box"></div>

      <el-table v-if="platformStats.length" :data="platformStats" style="width: 100%">
        <el-table-column prop="platform" label="平台" width="120">
          <template #default="{ row }">{{ platformText(row.platform) }}</template>
        </el-table-column>
        <el-table-column prop="submission_count" label="提交数" width="100" />
        <el-table-column prop="pending_count" label="待审数" width="100" />
        <el-table-column prop="approved_count" label="通过数" width="100" />
        <el-table-column prop="rejected_count" label="驳回数" width="100" />
        <el-table-column prop="total_paid_amount" label="实付金额" width="140">
          <template #default="{ row }">¥{{ row.total_paid_amount }}</template>
        </el-table-column>
        <el-table-column prop="total_reward_amount" label="返现金额" width="140">
          <template #default="{ row }">¥{{ row.total_reward_amount }}</template>
        </el-table-column>
      </el-table>

      <div v-else class="empty-state">暂无平台统计数据</div>
    </el-card>

    <el-card class="recent-submissions" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>最近提交</span>
          <el-button type="primary" link @click="$router.push('/submissions')">查看全部</el-button>
        </div>
      </template>

      <el-table v-if="recentSubmissions.length" :data="recentSubmissions" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">{{ platformText(row.platform) }}</template>
        </el-table-column>
        <el-table-column prop="task_title" label="任务标题" />
        <el-table-column prop="user_nickname" label="用户" width="120" />
        <el-table-column prop="paid_amount" label="实付金额" width="120">
          <template #default="{ row }">¥{{ row.paid_amount }}</template>
        </el-table-column>
        <el-table-column prop="review_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.review_status)">{{ statusText(row.review_status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="提交时间" width="180" />
      </el-table>

      <div v-else class="empty-state">暂无最近提交</div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Clock, Document, List, Wallet } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import { useEventListener } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { getPlatformStats, getSubmissions, getTasks } from '@/api/merchant'
import { platformText, submissionStatusTagType, submissionStatusText } from '@/utils/format'

const authStore = useAuthStore()
const monthKey = dayjs().format('YYYY-MM')
const lowBalanceThreshold = 500

const stats = ref({
  totalTasks: 0,
  totalSubmissions: 0,
  pendingReview: 0,
  totalPaidAmount: '0.00'
})

const recentSubmissions = ref([])
const platformStats = ref([])
const chartRef = ref(null)
let chartInstance = null
let echartsPromise = null
const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize()
  }
}

const merchantBalance = computed(() => Number(authStore.userInfo?.balance || 0).toFixed(2))
const lowBalanceWarning = computed(() => Number(authStore.userInfo?.balance || 0) < lowBalanceThreshold)

const totalRewardAmount = computed(() =>
  platformStats.value.reduce((sum, item) => sum + Number(item.total_reward_amount || 0), 0).toFixed(2)
)

const statCards = computed(() => [
  { label: '任务总数', value: stats.value.totalTasks, icon: List, color: '#409eff' },
  { label: '提交总数', value: stats.value.totalSubmissions, icon: Document, color: '#67c23a' },
  { label: '待审数量', value: stats.value.pendingReview, icon: Clock, color: '#e6a23c' },
  { label: '本月实付', value: `¥${stats.value.totalPaidAmount}`, icon: Wallet, color: '#f56c6c' }
])

const balanceCards = computed(() => [
  { label: '商家余额', value: `¥${merchantBalance.value}` },
  { label: '预警阈值', value: `¥${lowBalanceThreshold}` },
  { label: '本月返现总额', value: `¥${totalRewardAmount.value}` }
])

const statusText = (status) => submissionStatusText(status)

const statusTagType = (status) => submissionStatusTagType(status)

const loadEcharts = async () => {
  if (!echartsPromise) {
    echartsPromise = Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers')
    ]).then(([core, charts, components, renderers]) => {
      core.use([
        charts.BarChart,
        components.TooltipComponent,
        components.GridComponent,
        renderers.CanvasRenderer
      ])
      return core
    })
  }
  return echartsPromise
}

const renderChart = async () => {
  if (!chartRef.value || !platformStats.value.length) return

  const echarts = await loadEcharts()
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  chartInstance.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: platformStats.value.map(item => platformText(item.platform))
    },
    yAxis: { type: 'value' },
    series: [{
      name: '实付金额',
      type: 'bar',
      data: platformStats.value.map(item => Number(item.total_paid_amount || 0)),
      itemStyle: { color: '#409eff' }
    }]
  })
}

const loadStats = async () => {
  try {
    const [tasksRes, submissionsRes, pendingRes, platformRes] = await Promise.all([
      getTasks({ page: 1, page_size: 1 }),
      getSubmissions({ page: 1, page_size: 1 }),
      getSubmissions({ page: 1, page_size: 1, status: 0 }),
      getPlatformStats({ month_key: monthKey })
    ])

    stats.value.totalTasks = tasksRes.total || 0
    stats.value.totalSubmissions = submissionsRes.total || 0
    stats.value.pendingReview = pendingRes.total || 0
    stats.value.totalPaidAmount = (platformRes.list || []).reduce(
      (sum, item) => sum + Number(item.total_paid_amount || 0),
      0
    ).toFixed(2)

    recentSubmissions.value = submissionsRes.list || []
    platformStats.value = platformRes.list || []

    await nextTick()
    await renderChart()
  } catch (error) {
    console.error('加载看板数据失败', error)
  }
}

onMounted(() => {
  loadStats()
})

useEventListener(window, 'resize', handleResize)

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped>
.stat-card,
.mini-card {
  cursor: pointer;
  transition: all 0.3s;
}

.stat-card:hover,
.mini-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.stat-label,
.mini-label {
  font-size: 14px;
  color: #999;
}

.mini-card {
  min-height: 96px;
}

.mini-value {
  margin-top: 10px;
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-box {
  width: 100%;
  height: 320px;
  margin-bottom: 20px;
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 24px 0 0;
}
</style>
