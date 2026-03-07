<template>
  <div class="submissions-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>提交审核</span>
          <el-radio-group v-model="filterStatus" @change="loadSubmissions">
            <el-radio-button :label="null">全部</el-radio-button>
            <el-radio-button :label="0">待审核</el-radio-button>
            <el-radio-button :label="1">已通过</el-radio-button>
            <el-radio-button :label="2">已驳回</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <!-- 提交列表 -->
      <el-table :data="submissionList" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="task_title" label="任务标题" min-width="150" />
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
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              @click="viewDetail(row)"
            >
              查看详情
            </el-button>
            <el-button
              v-if="row.review_status === 0"
              type="success"
              link
              @click="handleReview(row, 1)"
            >
              通过
            </el-button>
            <el-button
              v-if="row.review_status === 0"
              type="danger"
              link
              @click="showRejectDialog(row)"
            >
              驳回
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
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

    <!-- 详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      title="提交详情"
      width="900px"
    >
      <div v-if="currentSubmission" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务标题">
            {{ currentSubmission.task_title }}
          </el-descriptions-item>
          <el-descriptions-item label="用户手机">
            {{ currentSubmission.user_phone }}
          </el-descriptions-item>
          <el-descriptions-item label="奖励金额">
            ¥{{ currentSubmission.reward_amount }}
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">
            {{ currentSubmission.submit_time }}
          </el-descriptions-item>
          <el-descriptions-item label="审核状态">
            <el-tag v-if="currentSubmission.review_status === 0" type="warning">待审核</el-tag>
            <el-tag v-else-if="currentSubmission.review_status === 1" type="success">已通过</el-tag>
            <el-tag v-else type="danger">已驳回</el-tag>
          </el-descriptions-item>
          <el-descriptions-item v-if="currentSubmission.review_time" label="审核时间">
            {{ currentSubmission.review_time }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 截图展示 -->
        <div class="screenshots">
          <h3>提交截图</h3>
          <el-row :gutter="16">
            <el-col :span="6" v-for="(item, index) in screenshots" :key="index">
              <div class="screenshot-item">
                <div class="screenshot-label">{{ item.label }}</div>
                <el-image
                  :src="item.url"
                  :preview-src-list="screenshotUrls"
                  fit="cover"
                  class="screenshot-image"
                />
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- 审核备注 -->
        <div v-if="currentSubmission.review_note" class="review-note">
          <h3>审核备注</h3>
          <p>{{ currentSubmission.review_note }}</p>
        </div>
      </div>
    </el-dialog>

    <!-- 驳回对话框 -->
    <el-dialog
      v-model="showRejectDialogVisible"
      title="驳回原因"
      width="500px"
    >
      <el-input
        v-model="rejectNote"
        type="textarea"
        :rows="4"
        placeholder="请输入驳回原因"
      />
      <template #footer>
        <el-button @click="showRejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="handleReject">确定驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getSubmissions, reviewSubmission } from '@/api/merchant'

const loading = ref(false)
const filterStatus = ref(null)
const submissionList = ref([])
const showDetailDialog = ref(false)
const showRejectDialogVisible = ref(false)
const currentSubmission = ref(null)
const currentReviewRow = ref(null)
const rejectNote = ref('')

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const screenshots = computed(() => {
  if (!currentSubmission.value) return []
  return [
    { label: '搜索关键词', url: currentSubmission.value.screenshot_search },
    { label: '浏览店铺1', url: currentSubmission.value.screenshot_shop_1 },
    { label: '浏览店铺2', url: currentSubmission.value.screenshot_shop_2 },
    { label: '浏览店铺3', url: currentSubmission.value.screenshot_shop_3 },
    { label: '关注评论', url: currentSubmission.value.screenshot_follow },
    { label: '分享截图', url: currentSubmission.value.screenshot_share },
    { label: '详情页', url: currentSubmission.value.screenshot_detail },
    { label: '加购截图', url: currentSubmission.value.screenshot_cart }
  ]
})

const screenshotUrls = computed(() => {
  return screenshots.value.map(item => item.url)
})

const loadSubmissions = async () => {
  try {
    loading.value = true
    const params = {
      page: pagination.page,
      page_size: pagination.page_size
    }
    if (filterStatus.value !== null) {
      params.review_status = filterStatus.value
    }

    const res = await getSubmissions(params)
    submissionList.value = res.list || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('加载提交列表失败', error)
  } finally {
    loading.value = false
  }
}

const viewDetail = (row) => {
  currentSubmission.value = row
  showDetailDialog.value = true
}

const handleReview = async (row, status) => {
  try {
    await ElMessageBox.confirm(
      status === 1 ? '确定通过该提交吗？' : '确定驳回该提交吗？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await reviewSubmission({
      submission_id: row.id,
      review_status: status,
      review_note: status === 1 ? '审核通过' : rejectNote.value
    })

    ElMessage.success('审核成功')
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
      submission_id: currentReviewRow.value.id,
      review_status: 2,
      review_note: rejectNote.value
    })

    ElMessage.success('驳回成功')
    showRejectDialogVisible.value = false
    loadSubmissions()
  } catch (error) {
    console.error('驳回失败', error)
  }
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
  cursor: pointer;
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
</style>
