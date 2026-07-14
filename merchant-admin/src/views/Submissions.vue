<template>
  <div class="submissions-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>提交审核</span>
          <div class="toolbar">
            <el-input v-model="filters.task_id" placeholder="任务ID" clearable style="width: 120px" @change="resetAndLoad" />
            <el-select v-model="filters.platform" placeholder="全部平台" clearable style="width: 130px" @change="resetAndLoad">
              <el-option label="抖音" value="douyin" />
              <el-option label="小红书" value="xiaohongshu" />
              <el-option label="淘宝" value="taobao" />
              <el-option label="京东" value="jd" />
            </el-select>
            <el-radio-group v-model="filters.status" @change="resetAndLoad">
              <el-radio-button :label="null">全部</el-radio-button>
              <el-radio-button :label="0">待审</el-radio-button>
              <el-radio-button :label="1">通过</el-radio-button>
              <el-radio-button :label="2">驳回</el-radio-button>
            </el-radio-group>
            <el-input v-model="filters.month_key" placeholder="月份 YYYY-MM" clearable style="width: 140px" @change="resetAndLoad" />
            <el-button @click="exportCsv">导出 CSV</el-button>
          </div>
        </div>
      </template>

      <el-table :data="submissionList" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="task_id" label="任务ID" width="100" />
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">{{ platformText(row.platform) }}</template>
        </el-table-column>
        <el-table-column prop="task_title" label="任务标题" min-width="180" />
        <el-table-column prop="user_nickname" label="用户" width="120" />
        <el-table-column prop="phone_number" label="手机号" width="140" />
        <el-table-column prop="paid_amount" label="实付金额" width="100">
          <template #default="{ row }">¥{{ row.paid_amount }}</template>
        </el-table-column>
        <el-table-column prop="reward_amount" label="返现金额" width="100">
          <template #default="{ row }">¥{{ row.reward_amount }}</template>
        </el-table-column>
        <el-table-column prop="review_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.review_status)">
              {{ statusText(row.review_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="提交时间" width="180" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="viewDetail(row)">查看</el-button>
            <el-button v-if="Number(row.review_status) === 0" type="success" link @click="handleReview(row, 1)">通过</el-button>
            <el-button v-if="Number(row.review_status) === 0" type="danger" link @click="showRejectDialog(row)">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && submissionList.length === 0" class="empty-state">暂无提交记录</div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :total="pagination.total"
          layout="total, prev, pager, next"
          @current-change="loadSubmissions"
        />
      </div>
    </el-card>

    <el-dialog v-model="showDetailDialog" title="提交详情" width="900px">
      <div v-if="currentSubmission" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="平台">{{ platformText(currentSubmission.platform) }}</el-descriptions-item>
          <el-descriptions-item label="任务标题">{{ currentSubmission.task_title }}</el-descriptions-item>
          <el-descriptions-item label="用户手机号">{{ currentSubmission.phone_number }}</el-descriptions-item>
          <el-descriptions-item label="实付金额">¥{{ currentSubmission.paid_amount }}</el-descriptions-item>
          <el-descriptions-item label="返现金额">¥{{ currentSubmission.reward_amount }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ currentSubmission.created_at }}</el-descriptions-item>
          <el-descriptions-item label="审核状态">
            <el-tag :type="statusTagType(currentSubmission.review_status)">
              {{ statusText(currentSubmission.review_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="currentSubmission.reviewed_at" label="审核时间">
            {{ currentSubmission.reviewed_at }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="screenshots">
          <h3>截图</h3>
          <el-row :gutter="16">
            <el-col :span="6" v-for="(item, index) in screenshots" :key="index">
              <div class="screenshot-item">
                <div class="screenshot-label">{{ item.label }}</div>
                <el-image :src="item.url" :preview-src-list="screenshotUrls" fit="cover" class="screenshot-image" />
              </div>
            </el-col>
          </el-row>
        </div>

        <div v-if="currentSubmission.reject_reason" class="review-note">
          <h3>驳回原因</h3>
          <p>{{ currentSubmission.reject_reason }}</p>
        </div>
      </div>
    </el-dialog>

    <el-dialog v-model="showRejectDialogVisible" title="驳回原因" width="500px">
      <el-input v-model="rejectNote" type="textarea" :rows="4" placeholder="请输入驳回原因" />
      <template #footer>
        <el-button @click="showRejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReject">确定驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSubmissions, reviewSubmission } from '@/api/merchant'
import { platformText, submissionStatusTagType, submissionStatusText } from '@/utils/format'

const loading = ref(false)
const submissionList = ref([])
const showDetailDialog = ref(false)
const showRejectDialogVisible = ref(false)
const currentSubmission = ref(null)
const currentReviewRow = ref(null)
const rejectNote = ref('')

const filters = reactive({
  task_id: '',
  platform: '',
  status: null,
  month_key: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const statusText = (status) => submissionStatusText(status)

const statusTagType = (status) => submissionStatusTagType(status)

const screenshots = computed(() => {
  if (!currentSubmission.value) return []
  return [
    { label: '搜索截图', url: currentSubmission.value.screenshot_search },
    { label: '店铺1', url: currentSubmission.value.screenshot_shop_1 },
    { label: '店铺2', url: currentSubmission.value.screenshot_shop_2 },
    { label: '店铺3', url: currentSubmission.value.screenshot_shop_3 },
    { label: '关注/评论', url: currentSubmission.value.screenshot_follow },
    { label: '分享', url: currentSubmission.value.screenshot_share },
    { label: '详情页', url: currentSubmission.value.screenshot_detail },
    { label: '加购', url: currentSubmission.value.screenshot_cart }
  ].filter(item => item.url)
})

const screenshotUrls = computed(() => screenshots.value.map(item => item.url))

const buildParams = () => {
  const params = {
    page: pagination.page,
    page_size: pagination.page_size
  }
  if (filters.task_id) params.task_id = filters.task_id
  if (filters.platform) params.platform = filters.platform
  if (filters.status !== null && filters.status !== '') params.status = filters.status
  if (filters.month_key) params.month_key = filters.month_key
  return params
}

const loadSubmissions = async () => {
  try {
    loading.value = true
    const res = await getSubmissions(buildParams())
    submissionList.value = res.list || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('加载提交列表失败', error)
  } finally {
    loading.value = false
  }
}

const resetAndLoad = () => {
  pagination.page = 1
  loadSubmissions()
}

const viewDetail = (row) => {
  currentSubmission.value = row
  showDetailDialog.value = true
}

const handleReview = async (row, status) => {
  try {
    await ElMessageBox.confirm(
      status === 1 ? '确认通过该提交吗？' : '确认驳回该提交吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await reviewSubmission({
      id: row.id,
      review_status: status,
      review_note: status === 1 ? '审核通过' : rejectNote.value
    })

    ElMessage.success('审核完成')
    loadSubmissions()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('审核失败', error)
    }
  }
}

const showRejectDialog = (row) => {
  currentReviewRow.value = row
  rejectNote.value = ''
  showRejectDialogVisible.value = true
}

const handleReject = async () => {
  if (!rejectNote.value.trim()) {
    ElMessage.warning('请输入驳回原因')
    return
  }

  try {
    await reviewSubmission({
      id: currentReviewRow.value.id,
      review_status: 2,
      review_note: rejectNote.value
    })

    ElMessage.success('驳回成功')
    showRejectDialogVisible.value = false
    currentReviewRow.value = null
    rejectNote.value = ''
    loadSubmissions()
  } catch (error) {
    console.error('驳回失败', error)
  }
}

const exportCsv = () => {
  const headers = ['ID', '任务ID', '平台', '任务标题', '用户', '手机号', '实付金额', '返现金额', '状态', '提交时间']
  const rows = submissionList.value.map(item => [
    item.id,
    item.task_id,
    platformText(item.platform),
    item.task_title,
    item.user_nickname || '',
    item.phone_number || '',
    item.paid_amount,
    item.reward_amount,
    statusText(item.review_status),
    item.created_at
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'submissions.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(() => {
  loadSubmissions()
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

.detail-content {
  padding: 20px 0;
}

.screenshots {
  margin-top: 30px;
}

.screenshots h3 {
  margin-bottom: 16px;
  font-size: 16px;
  color: #333;
}

.screenshot-item {
  margin-bottom: 16px;
}

.screenshot-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.screenshot-image {
  width: 100%;
  height: 200px;
  border-radius: 8px;
}

.review-note {
  margin-top: 30px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.review-note h3 {
  margin-bottom: 12px;
  font-size: 16px;
  color: #333;
}

.review-note p {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.empty-state {
  text-align: center;
  color: #999;
  padding: 24px 0 0;
}
</style>
