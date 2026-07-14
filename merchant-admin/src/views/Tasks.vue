<template>
  <div class="tasks-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>任务管理</span>
          <div class="toolbar">
            <el-select v-model="filters.platform" placeholder="全部平台" clearable style="width: 140px" @change="resetAndLoad">
              <el-option label="抖音" value="douyin" />
              <el-option label="小红书" value="xiaohongshu" />
              <el-option label="淘宝" value="taobao" />
              <el-option label="京东" value="jd" />
            </el-select>
            <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px" @change="resetAndLoad">
              <el-option label="进行中" :value="1" />
              <el-option label="已暂停" :value="2" />
              <el-option label="已结束" :value="3" />
            </el-select>
            <el-button type="primary" @click="openCreateDialog">
              <el-icon><Plus /></el-icon>
              创建任务
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="taskList" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="platform" label="平台" width="100">
          <template #default="{ row }">{{ platformText(row.platform) }}</template>
        </el-table-column>
        <el-table-column prop="title" label="任务标题" min-width="180" />
        <el-table-column prop="search_keyword" label="搜索关键词" min-width="140" />
        <el-table-column prop="reward_amount" label="奖励金额" width="110">
          <template #default="{ row }">¥{{ row.reward_amount }}</template>
        </el-table-column>
        <el-table-column prop="start_time" label="发布时间" width="180" />
        <el-table-column label="名额" width="120">
          <template #default="{ row }">{{ row.remaining_quota }}/{{ row.total_quota }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEditDialog(row)">编辑</el-button>
            <el-button type="success" link @click="openCopyDialog(row)">复制</el-button>
            <el-button type="primary" link @click="openShareDialog(row)">
              <el-icon><Share /></el-icon>
              分享
            </el-button>
            <el-button v-if="Number(row.status) === 1" type="warning" link @click="handleStatusChange(row, 2)">暂停</el-button>
            <el-button v-if="Number(row.status) === 2" type="primary" link @click="handleStatusChange(row, 1)">恢复</el-button>
            <el-button v-if="Number(row.status) !== 3" type="danger" link @click="handleStatusChange(row, 3)">结束</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loading && taskList.length === 0" class="empty-state">暂无任务</div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :total="pagination.total"
          layout="total, prev, pager, next"
          @current-change="loadTasks"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="showDialog"
      :title="dialogMode === 'edit' ? '编辑任务' : '创建任务'"
      width="720px"
      @close="handleDialogClose"
    >
      <el-alert
        v-if="dialogMode === 'edit'"
        title="编辑模式仅修改任务内容，不调整奖励金额和名额。若需改变奖励结构，请复制后重新创建。"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 16px;"
      />

      <el-form ref="formRef" :model="taskForm" :rules="taskRules" label-width="120px">
        <el-form-item label="平台" prop="platform">
          <el-select v-model="taskForm.platform" placeholder="请选择平台" style="width: 100%">
            <el-option label="抖音" value="douyin" />
            <el-option label="小红书" value="xiaohongshu" />
            <el-option label="淘宝" value="taobao" />
            <el-option label="京东" value="jd" />
          </el-select>
        </el-form-item>

        <el-form-item label="任务标题" prop="title">
          <el-input v-model="taskForm.title" placeholder="请输入任务标题" />
        </el-form-item>

        <el-form-item label="任务描述" prop="description">
          <el-input v-model="taskForm.description" type="textarea" :rows="3" placeholder="请输入任务描述" />
        </el-form-item>

        <el-form-item label="搜索关键词" prop="search_keyword">
          <el-input v-model="taskForm.search_keyword" placeholder="请输入搜索关键词" />
        </el-form-item>

        <el-form-item label="店铺名称" prop="shop_name">
          <el-input v-model="taskForm.shop_name" placeholder="请输入店铺名称" />
        </el-form-item>

        <el-form-item label="商品链接" prop="product_link">
          <el-input v-model="taskForm.product_link" placeholder="请输入商品链接" />
        </el-form-item>

        <el-form-item label="奖励金额" prop="reward_amount">
          <el-input-number
            v-model="taskForm.reward_amount"
            :min="0.01"
            :step="0.1"
            :precision="2"
            :disabled="dialogMode === 'edit'"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="任务名额" prop="total_quota">
          <el-input-number
            v-model="taskForm.total_quota"
            :min="1"
            :disabled="dialogMode === 'edit'"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="定时发布">
          <el-switch v-model="scheduleEnabled" />
          <span class="field-hint">关闭时立即发布，开启后按发布时间自动上架</span>
        </el-form-item>

        <el-form-item label="发布时间" prop="start_time">
          <el-date-picker
            v-model="taskForm.start_time"
            type="datetime"
            placeholder="选择发布时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            :disabled="!scheduleEnabled"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="结束时间" prop="end_time">
          <el-date-picker
            v-model="taskForm.end_time"
            type="datetime"
            placeholder="选择结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ dialogMode === 'edit' ? '保存修改' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="shareDialogVisible" title="分享任务" width="420px">
      <div v-if="shareTask" class="share-box">
        <div class="share-meta">
          <div class="share-title">{{ shareTask.title }}</div>
          <div class="share-desc">任务ID：{{ shareTask.id }} | 平台：{{ platformText(shareTask.platform) }}</div>
          <div class="share-desc">奖励：¥{{ shareTask.reward_amount }} | 关键词：{{ shareTask.search_keyword || '-' }}</div>
        </div>
        <div class="share-code">
          <el-skeleton v-if="shareQrLoading" :rows="5" animated />
          <img v-else-if="shareQrCode" :src="shareQrCode" alt="任务二维码" class="qr-image" />
          <div v-else class="empty-state">二维码生成失败</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="shareDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Share } from '@element-plus/icons-vue'
import QRCode from 'qrcode'
import { useDebounceFn } from '@vueuse/core'
import { useAuthStore } from '@/stores/auth'
import { createTask, getTasks, updateTask, updateTaskStatus } from '@/api/merchant'
import { platformText, taskStatusTagType, taskStatusText } from '@/utils/format'

const authStore = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const showDialog = ref(false)
const dialogMode = ref('create')
const editingTaskId = ref(null)
const taskList = ref([])
const formRef = ref(null)
const shareDialogVisible = ref(false)
const shareTask = ref(null)
const shareQrCode = ref('')
const shareQrLoading = ref(false)
const scheduleEnabled = ref(false)
const scheduleSaveDraft = useDebounceFn(() => saveDraft(), 250)

const filters = reactive({
  platform: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const createFormState = () => ({
  platform: 'taobao',
  title: '',
  description: '',
  search_keyword: '',
  shop_name: '',
  product_link: '',
  reward_amount: 0,
  total_quota: 1,
  start_time: '',
  end_time: ''
})

const taskForm = reactive(createFormState())

const draftKey = computed(() => {
  const merchantId = authStore.userInfo?.id || 'guest'
  const scope = dialogMode.value === 'edit' && editingTaskId.value ? `edit:${editingTaskId.value}` : 'create'
  return `merchant-admin:task-form-draft:${merchantId}:${scope}`
})

const taskRules = {
  platform: [{ required: true, message: '请选择平台', trigger: 'change' }],
  title: [{ required: true, message: '请输入任务标题', trigger: 'blur' }],
  search_keyword: [{ required: true, message: '请输入搜索关键词', trigger: 'blur' }],
  shop_name: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }],
  reward_amount: [{ required: true, message: '请输入奖励金额', trigger: 'blur' }],
  total_quota: [{ required: true, message: '请输入任务名额', trigger: 'blur' }],
  end_time: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

const statusText = (status) => taskStatusText(status)

const statusTagType = (status) => taskStatusTagType(status)

const buildParams = () => {
  const params = {
    page: pagination.page,
    page_size: pagination.page_size
  }
  if (filters.platform) params.platform = filters.platform
  if (filters.status !== '' && filters.status !== null) params.status = filters.status
  return params
}

const loadTasks = async () => {
  try {
    loading.value = true
    const res = await getTasks(buildParams())
    taskList.value = res.list || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('加载任务列表失败', error)
  } finally {
    loading.value = false
  }
}

const resetAndLoad = () => {
  pagination.page = 1
  loadTasks()
}

const saveDraft = () => {
  if (!showDialog.value) return
  localStorage.setItem(
    draftKey.value,
    JSON.stringify({
      form: { ...taskForm },
      scheduleEnabled: scheduleEnabled.value
    })
  )
}

const loadDraft = () => {
  const raw = localStorage.getItem(draftKey.value)
  if (!raw) return false

  try {
    const parsed = JSON.parse(raw)
    if (parsed?.form) {
      Object.assign(taskForm, createFormState(), parsed.form)
      scheduleEnabled.value = Boolean(parsed.scheduleEnabled ?? parsed.form.start_time)
      return true
    }
  } catch (error) {
    console.error('加载草稿失败', error)
  }

  return false
}

const clearDraft = () => {
  localStorage.removeItem(draftKey.value)
}

const buildShareText = (task) => {
  if (!task) return ''
  const lines = [
    `任务ID: ${task.id || ''}`,
    `标题: ${task.title || ''}`,
    `平台: ${platformText(task.platform)}`,
    `奖励: ¥${task.reward_amount || 0}`,
    `关键词: ${task.search_keyword || ''}`
  ]
  return lines.join('\n')
}

const openShareDialog = async (task) => {
  shareTask.value = task
  shareDialogVisible.value = true
  shareQrLoading.value = true
  shareQrCode.value = ''

  try {
    shareQrCode.value = await QRCode.toDataURL(buildShareText(task), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280
    })
  } catch (error) {
    console.error('生成任务二维码失败', error)
    ElMessage.error('二维码生成失败')
  } finally {
    shareQrLoading.value = false
  }
}

const fillForm = (task) => {
  Object.assign(taskForm, {
    platform: task.platform || 'taobao',
    title: task.title || '',
    description: task.description || '',
    search_keyword: task.search_keyword || '',
    shop_name: task.shop_name || '',
    product_link: task.product_link || '',
    reward_amount: task.reward_amount || 0,
    total_quota: task.total_quota || 1,
    start_time: task.start_time || '',
    end_time: task.end_time || ''
  })
}

const openCreateDialog = () => {
  dialogMode.value = 'create'
  editingTaskId.value = null
  Object.assign(taskForm, createFormState())
  scheduleEnabled.value = false
  showDialog.value = true
  loadDraft()
}

const openEditDialog = (task) => {
  dialogMode.value = 'edit'
  editingTaskId.value = task.id
  Object.assign(taskForm, createFormState())
  fillForm(task)
  scheduleEnabled.value = !!task.start_time
  showDialog.value = true
  loadDraft()
}

const openCopyDialog = (task) => {
  dialogMode.value = 'create'
  editingTaskId.value = null
  Object.assign(taskForm, createFormState())
  fillForm({
    ...task,
    title: `${task.title} - 复制`
  })
  scheduleEnabled.value = !!task.start_time
  showDialog.value = true
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    if (scheduleEnabled.value && !taskForm.start_time) {
      ElMessage.warning('请先选择发布时间')
      return
    }

    submitting.value = true

    if (dialogMode.value === 'edit') {
      await updateTask({
        id: editingTaskId.value,
        platform: taskForm.platform,
        title: taskForm.title,
        description: taskForm.description,
        search_keyword: taskForm.search_keyword,
        shop_name: taskForm.shop_name,
        product_link: taskForm.product_link,
        start_time: scheduleEnabled.value ? taskForm.start_time : '',
        end_time: taskForm.end_time
      })
      ElMessage.success('任务已更新')
    } else {
      await createTask({
        ...taskForm,
        start_time: scheduleEnabled.value ? taskForm.start_time : ''
      })
      ElMessage.success(scheduleEnabled.value ? '任务已设置定时发布' : '创建成功')
    }

    clearDraft()
    showDialog.value = false
    loadTasks()
  } catch (error) {
    if (error !== false) {
      console.error('保存任务失败', error)
    }
  } finally {
    submitting.value = false
  }
}

const handleStatusChange = async (row, status) => {
  const statusMap = {
    1: '恢复',
    2: '暂停',
    3: '结束'
  }

  try {
    await ElMessageBox.confirm(`确认${statusMap[status]}任务「${row.title}」吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await updateTaskStatus({
      id: row.id,
      status
    })

    ElMessage.success('任务状态已更新')
    loadTasks()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('更新任务状态失败', error)
    }
  }
}

const handleDialogClose = () => {
  saveDraft()
}

watch(
  taskForm,
  () => {
    scheduleSaveDraft()
  },
  { deep: true }
)

watch(scheduleEnabled, (enabled) => {
  if (!enabled) {
    taskForm.start_time = ''
  }
  scheduleSaveDraft()
})

watch(showDialog, (visible) => {
  if (!visible) {
    saveDraft()
  }
})

onMounted(() => {
  loadTasks()
})

onBeforeUnmount(() => {
  saveDraft()
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

.field-hint {
  margin-left: 12px;
  color: #8b8f97;
  font-size: 12px;
  line-height: 1.5;
}

.share-box {
  display: grid;
  gap: 16px;
}

.share-meta {
  display: grid;
  gap: 6px;
}

.share-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.share-desc {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

.share-code {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}

.qr-image {
  width: 280px;
  height: 280px;
  display: block;
}
</style>
