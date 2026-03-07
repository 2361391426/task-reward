<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <!-- 统计卡片 -->
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #409eff">
              <el-icon size="32"><List /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalTasks }}</div>
              <div class="stat-label">总任务数</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #67c23a">
              <el-icon size="32"><Document /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalSubmissions }}</div>
              <div class="stat-label">总提交数</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #e6a23c">
              <el-icon size="32"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.pendingReview }}</div>
              <div class="stat-label">待审核</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: #f56c6c">
              <el-icon size="32"><Wallet /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">¥{{ stats.totalAmount }}</div>
              <div class="stat-label">总支出</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 最近提交 -->
    <el-card class="recent-submissions" style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>最近提交</span>
          <el-button type="primary" link @click="$router.push('/submissions')">
            查看全部
          </el-button>
        </div>
      </template>

      <el-table :data="recentSubmissions" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="task_title" label="任务标题" />
        <el-table-column prop="user_phone" label="用户手机" width="120" />
        <el-table-column prop="reward_amount" label="奖励金额" width="100">
          <template #default="{ row }">
            ¥{{ row.reward_amount }}
          </template>
        </el-table-column>
        <el-table-column prop="review_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.review_status === 0" type="warning">待审核</el-tag>
            <el-tag v-else-if="row.review_status === 1" type="success">已通过</el-tag>
            <el-tag v-else type="danger">已驳回</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="submit_time" label="提交时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getTasks, getSubmissions } from '@/api/merchant'

const stats = ref({
  totalTasks: 0,
  totalSubmissions: 0,
  pendingReview: 0,
  totalAmount: 0
})

const recentSubmissions = ref([])

const loadStats = async () => {
  try {
    const [tasksRes, submissionsRes] = await Promise.all([
      getTasks({ page: 1, page_size: 1 }),
      getSubmissions({ page: 1, page_size: 10 })
    ])

    stats.value.totalTasks = tasksRes.total || 0
    stats.value.totalSubmissions = submissionsRes.total || 0
    stats.value.pendingReview = submissionsRes.list?.filter(item => item.review_status === 0).length || 0

    // 计算总支出
    const approvedSubmissions = submissionsRes.list?.filter(item => item.review_status === 1) || []
    stats.value.totalAmount = approvedSubmissions.reduce((sum, item) => sum + parseFloat(item.reward_amount), 0).toFixed(2)

    recentSubmissions.value = submissionsRes.list || []
  } catch (error) {
    console.error('加载统计数据失败', error)
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.stat-card {
  cursor: pointer;
  transition: all 0.3s;
}

.stat-card:hover {
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

.stat-label {
  font-size: 14px;
  color: #999;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
