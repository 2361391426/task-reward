<template>
  <div class="withdrawals-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>提现审核</span>
          <div class="toolbar">
            <el-radio-group v-model="filterStatus" @change="resetAndLoad">
              <el-radio-button :label="null">全部</el-radio-button>
              <el-radio-button :label="0">待处理</el-radio-button>
              <el-radio-button :label="1">已通过</el-radio-button>
              <el-radio-button :label="2">已驳回</el-radio-button>
            </el-radio-group>
            <el-button @click="exportCsv">导出 CSV</el-button>
          </div>
        </div>
      </template>

      <el-table :data="withdrawalList" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="nickname" label="用户" width="140" />
        <el-table-column prop="amount" label="提现金额" width="120">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="fee" label="手续费" width="120">
          <template #default="{ row }">¥{{ row.fee }}</template>
        </el-table-column>
        <el-table-column prop="actual_amount" label="实际到账" width="120">
          <template #default="{ row }">¥{{ row.actual_amount }}</template>
        </el-table-column>
        <el-table-column prop="withdraw_type" label="方式" width="100">
          <template #default="{ row }">{{ withdrawTypeText(row.withdraw_type) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="account_info" label="账户信息" min-width="220" />
        <el-table-column prop="created_at" label="申请时间" width="180" />
        <el-table-column prop="processed_at" label="处理时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="Number(row.status) === 0" type="success" link @click="handleReview(row, 1)">通过</el-button>
            <el-button v-if="Number(row.status) === 0" type="danger" link @click="showRejectDialog(row)">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && withdrawalList.length === 0" class="empty-state">暂无提现记录</div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :total="pagination.total"
          layout="total, prev, pager, next"
          @current-change="loadWithdrawals"
        />
      </div>
    </el-card>

    <el-dialog v-model="showRejectDialogVisible" title="驳回原因" width="500px">
      <el-input v-model="rejectReason" type="textarea" :rows="4" placeholder="请输入驳回原因" />
      <template #footer>
        <el-button @click="showRejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReject">确定驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getWithdrawals, reviewWithdrawal } from '@/api/merchant'
import { withdrawTypeText, withdrawalStatusTagType, withdrawalStatusText } from '@/utils/format'

const loading = ref(false)
const filterStatus = ref(null)
const withdrawalList = ref([])
const showRejectDialogVisible = ref(false)
const currentWithdrawal = ref(null)
const rejectReason = ref('')

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const statusText = (status) => withdrawalStatusText(status)

const statusTagType = (status) => withdrawalStatusTagType(status)

const buildParams = () => {
  const params = {
    page: pagination.page,
    page_size: pagination.page_size
  }
  if (filterStatus.value !== null && filterStatus.value !== '') {
    params.status = filterStatus.value
  }
  return params
}

const loadWithdrawals = async () => {
  try {
    loading.value = true
    const res = await getWithdrawals(buildParams())
    withdrawalList.value = res.list || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('加载提现列表失败', error)
  } finally {
    loading.value = false
  }
}

const resetAndLoad = () => {
  pagination.page = 1
  loadWithdrawals()
}

const handleReview = async (row, status) => {
  try {
    await ElMessageBox.confirm(
      status === 1 ? '确认通过这笔提现吗？' : '确认驳回这笔提现吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await reviewWithdrawal({
      id: row.id,
      status,
      reject_reason: status === 2 ? rejectReason.value : ''
    })

    ElMessage.success('处理成功')
    showRejectDialogVisible.value = false
    currentWithdrawal.value = null
    rejectReason.value = ''
    loadWithdrawals()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('处理提现失败', error)
    }
  }
}

const showRejectDialog = (row) => {
  currentWithdrawal.value = row
  rejectReason.value = ''
  showRejectDialogVisible.value = true
}

const handleReject = async () => {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请输入驳回原因')
    return
  }

  try {
    await reviewWithdrawal({
      id: currentWithdrawal.value.id,
      status: 2,
      reject_reason: rejectReason.value
    })
    ElMessage.success('驳回成功')
    showRejectDialogVisible.value = false
    currentWithdrawal.value = null
    rejectReason.value = ''
    loadWithdrawals()
  } catch (error) {
    console.error('驳回提现失败', error)
  }
}

const exportCsv = () => {
  const headers = ['ID', '用户', '提现金额', '手续费', '实际到账', '方式', '状态', '账户信息', '申请时间', '处理时间']
  const rows = withdrawalList.value.map(item => [
    item.id,
    item.nickname || '',
    item.amount,
    item.fee,
    item.actual_amount,
    withdrawTypeText(item.withdraw_type),
    statusText(item.status),
    item.account_info || '',
    item.created_at || '',
    item.processed_at || ''
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'withdrawals.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(() => {
  loadWithdrawals()
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
  align-items: center;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 24px 0 0;
}
</style>
