<template>
  <div class="tasks-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>任务管理</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建任务
          </el-button>
        </div>
      </template>

      <!-- 任务列表 -->
      <el-table :data="taskList" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="任务标题" min-width="200" />
        <el-table-column prop="search_keyword" label="搜索关键词" width="120" />
        <el-table-column prop="reward_amount" label="奖励金额" width="100">
          <template #default="{ row }">
            ¥{{ row.reward_amount }}
          </template>
        </el-table-column>
        <el-table-column label="名额" width="120">
          <template #default="{ row }">
            {{ row.used_quota }}/{{ row.total_quota }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 1" type="success">进行中</el-tag>
            <el-tag v-else type="info">已结束</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="end_time" label="结束时间" width="180" />
      </el-table>

      <!-- 分页 -->
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

    <!-- 创建任务对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      title="创建任务"
      width="600px"
      @close="resetForm"
    >
      <el-form :model="taskForm" :rules="taskRules" ref="formRef" label-width="120px">
        <el-form-item label="任务标题" prop="title">
          <el-input v-model="taskForm.title" placeholder="请输入任务标题" />
        </el-form-item>

        <el-form-item label="搜索关键词" prop="search_keyword">
          <el-input v-model="taskForm.search_keyword" placeholder="请输入搜索关键词" />
        </el-form-item>

        <el-form-item label="店铺名称" prop="shop_name">
          <el-input v-model="taskForm.shop_name" placeholder="请输入店铺名称" />
        </el-form-item>

        <el-form-item label="商品名称" prop="product_name">
          <el-input v-model="taskForm.product_name" placeholder="请输入商品名称" />
        </el-form-item>

        <el-form-item label="奖励金额" prop="reward_amount">
          <el-input-number
            v-model="taskForm.reward_amount"
            :min="0.01"
            :step="0.1"
            :precision="2"
            placeholder="请输入奖励金额"
          />
        </el-form-item>

        <el-form-item label="任务名额" prop="total_quota">
          <el-input-number
            v-model="taskForm.total_quota"
            :min="1"
            placeholder="请输入任务名额"
          />
        </el-form-item>

        <el-form-item label="结束时间" prop="end_time">
          <el-date-picker
            v-model="taskForm.end_time"
            type="datetime"
            placeholder="选择结束时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">
          创建
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getTasks, createTask } from '@/api/merchant'

const loading = ref(false)
const submitting = ref(false)
const showCreateDialog = ref(false)
const taskList = ref([])
const formRef = ref(null)

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const taskForm = reactive({
  title: '',
  search_keyword: '',
  shop_name: '',
  product_name: '',
  reward_amount: 0,
  total_quota: 1,
  end_time: ''
})

const taskRules = {
  title: [{ required: true, message: '请输入任务标题', trigger: 'blur' }],
  search_keyword: [{ required: true, message: '请输入搜索关键词', trigger: 'blur' }],
  shop_name: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }],
  product_name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  reward_amount: [{ required: true, message: '请输入奖励金额', trigger: 'blur' }],
  total_quota: [{ required: true, message: '请输入任务名额', trigger: 'blur' }],
  end_time: [{ required: true, message: '请选择结束时间', trigger: 'change' }]
}

const loadTasks = async () => {
  try {
    loading.value = true
    const res = await getTasks({
      page: pagination.page,
      page_size: pagination.page_size
    })
    taskList.value = res.list || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('加载任务列表失败', error)
  } finally {
    loading.value = false
  }
}

const handleCreate = async () => {
  try {
    await formRef.value.validate()
    submitting.value = true

    await createTask(taskForm)
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    loadTasks()
  } catch (error) {
    console.error('创建任务失败', error)
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  formRef.value?.resetFields()
  Object.assign(taskForm, {
    title: '',
    search_keyword: '',
    shop_name: '',
    product_name: '',
    reward_amount: 0,
    total_quota: 1,
    end_time: ''
  })
}

onMounted(() => {
  loadTasks()
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
</style>
