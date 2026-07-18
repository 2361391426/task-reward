<template>
  <div class="page">
    <el-card class="card-panel">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">员工账号</div>
            <div class="subtitle">管理商家后台操作员、审核员和财务角色</div>
          </div>
          <el-button type="primary" @click="openCreateDialog">新增员工</el-button>
        </div>
      </template>

      <el-table :data="staffList" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" min-width="160" />
        <el-table-column prop="nickname" label="昵称" min-width="160" />
        <el-table-column prop="role" label="角色" width="140">
          <template #default="{ row }">{{ roleText(row.role) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="Number(row.status) === 1 ? 'success' : 'info'">
              {{ Number(row.status) === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEditDialog(row)">编辑</el-button>
            <el-button type="warning" link @click="toggleStatus(row)">
              {{ Number(row.status) === 1 ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogMode === 'create' ? '新增员工' : '编辑员工'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名"
            :disabled="dialogMode === 'edit'"
          />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="运营" value="operator" />
            <el-option label="审核" value="reviewer" />
            <el-option label="财务" value="finance" />
          </el-select>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="创建时必填，编辑时可留空"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="saveStaff">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createMerchantStaff, getMerchantStaffs, updateMerchantStaff } from '@/api/merchant'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref('create')
const editingId = ref(null)
const formRef = ref(null)
const staffList = ref([])

const form = reactive({
  username: '',
  nickname: '',
  role: 'operator',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [
    {
      validator: (_rule, value, callback) => {
        if (dialogMode.value === 'create' && !value) {
          callback(new Error('请输入密码'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

const roleText = (role) => {
  const map = {
    operator: '运营',
    reviewer: '审核',
    finance: '财务'
  }
  return map[role] || role || '-'
}

const loadStaffs = async () => {
  loading.value = true
  try {
    const res = await getMerchantStaffs()
    staffList.value = res?.list || []
  } catch (error) {
    console.error('加载员工列表失败', error)
    ElMessage.error('员工列表加载失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.username = ''
  form.nickname = ''
  form.role = 'operator'
  form.password = ''
}

const openCreateDialog = () => {
  dialogMode.value = 'create'
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogMode.value = 'edit'
  editingId.value = row.id
  form.username = row.username || ''
  form.nickname = row.nickname || ''
  form.role = row.role || 'operator'
  form.password = ''
  dialogVisible.value = true
}

const saveStaff = async () => {
  try {
    await formRef.value.validate()
    submitting.value = true

    const payload = {
      username: form.username,
      nickname: form.nickname,
      role: form.role
    }

    if (form.password) {
      payload.password = form.password
    }

    if (dialogMode.value === 'create') {
      await createMerchantStaff(payload)
      ElMessage.success('员工已创建')
    } else {
      payload.id = editingId.value
      await updateMerchantStaff(payload)
      ElMessage.success('员工已更新')
    }

    dialogVisible.value = false
    await loadStaffs()
  } catch (error) {
    if (error !== false) {
      console.error('保存员工失败', error)
    }
  } finally {
    submitting.value = false
  }
}

const toggleStatus = async (row) => {
  try {
    await updateMerchantStaff({
      id: row.id,
      status: Number(row.status) === 1 ? 2 : 1
    })
    ElMessage.success('状态已更新')
    await loadStaffs()
  } catch (error) {
    console.error('切换员工状态失败', error)
    ElMessage.error('状态更新失败')
  }
}

onMounted(() => {
  loadStaffs()
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
}

.card-panel {
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}
</style>
