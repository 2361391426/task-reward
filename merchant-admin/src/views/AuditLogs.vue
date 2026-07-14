<template>
  <div class="logs-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>审计日志</span>
          <div class="toolbar">
            <el-select v-model="filters.action" placeholder="全部动作" clearable style="width: 160px" @change="resetAndLoad">
              <el-option label="任务创建" value="task_create" />
              <el-option label="任务更新" value="task_update" />
              <el-option label="状态变更" value="task_status_change" />
              <el-option label="提交审核" value="submission_review" />
              <el-option label="提现申请" value="withdrawal_request" />
              <el-option label="提现审核" value="withdrawal_review" />
            </el-select>
            <el-select v-model="filters.target_type" placeholder="全部类型" clearable style="width: 140px" @change="resetAndLoad">
              <el-option label="任务" value="task" />
              <el-option label="提交" value="submission" />
              <el-option label="提现" value="withdrawal" />
            </el-select>
            <el-button @click="exportCsv">导出 CSV</el-button>
          </div>
        </div>
      </template>

      <el-table :data="logList" v-loading="loading">
        <el-table-column prop="created_at" label="时间" width="180" />
        <el-table-column prop="action" label="动作" width="150" />
        <el-table-column prop="target_type" label="类型" width="100" />
        <el-table-column prop="target_id" label="目标ID" width="100" />
        <el-table-column prop="summary" label="摘要" min-width="220" />
        <el-table-column prop="detail" label="详情" min-width="300">
          <template #default="{ row }">
            <pre class="detail">{{ formatDetail(row.detail) }}</pre>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && logList.length === 0" class="empty-state">暂无审计日志</div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :total="pagination.total"
          layout="total, prev, pager, next"
          @current-change="loadLogs"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { getAuditLogs } from '@/api/merchant'

const loading = ref(false)
const logList = ref([])
const filters = reactive({
  action: '',
  target_type: ''
})
const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0
})

const loadLogs = async () => {
  try {
    loading.value = true
    const params = {
      page: pagination.page,
      page_size: pagination.page_size
    }
    if (filters.action) params.action = filters.action
    if (filters.target_type) params.target_type = filters.target_type

    const res = await getAuditLogs(params)
    logList.value = res.list || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('加载审计日志失败', error)
  } finally {
    loading.value = false
  }
}

const resetAndLoad = () => {
  pagination.page = 1
  loadLogs()
}

const formatDetail = (detail) => {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  return JSON.stringify(detail, null, 2)
}

const exportCsv = () => {
  const headers = ['时间', '动作', '类型', '目标ID', '摘要', '详情']
  const rows = logList.value.map(item => [
    item.created_at,
    item.action,
    item.target_type,
    item.target_id,
    item.summary || '',
    formatDetail(item.detail).replaceAll('\n', ' ')
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'audit_logs.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.detail {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: Consolas, monospace;
  font-size: 12px;
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 24px 0 0;
}
</style>
