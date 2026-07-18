<template>
  <div class="page">
    <el-card class="card-panel">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">用户权限管理</div>
            <div class="subtitle">为已注册用户分配“我的发单”查看权限</div>
          </div>
          <div class="filters">
            <el-input
              v-model="keyword"
              placeholder="搜索昵称 / 手机号 / OpenID"
              clearable
              class="filter-input"
              @keyup.enter="loadUsers"
            />
            <el-select v-model="permission" placeholder="权限状态" clearable class="filter-select">
              <el-option label="全部" :value="''" />
              <el-option label="已开通" :value="1" />
              <el-option label="未开通" :value="0" />
            </el-select>
            <el-button type="primary" @click="loadUsers">搜索</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </div>
        </div>
      </template>

      <el-table :data="userList" v-loading="loading" stripe border>
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="42" :src="row.avatar">
                {{ row.nickname?.slice(0, 1) || 'U' }}
              </el-avatar>
              <div class="user-meta">
                <div class="user-name">{{ row.nickname || '未命名用户' }}</div>
                <div class="user-sub">手机号：{{ row.phone || '-' }}</div>
                <div class="user-sub">openid：{{ row.openid || '-' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="publish_permission" label="发单权限" width="150">
          <template #default="{ row }">
            <el-tag :type="Number(row.publish_permission) === 1 ? 'success' : 'info'">
              {{ Number(row.publish_permission) === 1 ? '已开通' : '未开通' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="Number(row.status) === 1 ? 'success' : 'danger'">
              {{ Number(row.status) === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="180" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="togglePermission(row)">
              {{ Number(row.publish_permission) === 1 ? '关闭权限' : '开通权限' }}
            </el-button>
            <el-button type="info" link @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, prev, pager, next, sizes"
          :total="total"
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[10, 20, 30, 50]"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getMerchantUsers, updateMerchantUserPermission } from '@/api/merchant'
import { formatTime } from '@/utils/format'

const loading = ref(false)
const userList = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const permission = ref('')

const loadUsers = async () => {
  loading.value = true
  try {
    const res = await getMerchantUsers({
      page: page.value,
      page_size: pageSize.value,
      keyword: keyword.value,
      publish_permission: permission.value
    })
    userList.value = res?.list || []
    total.value = res?.total || 0
  } catch (error) {
    console.error('加载用户权限失败', error)
    ElMessage.error('用户列表加载失败')
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  keyword.value = ''
  permission.value = ''
  page.value = 1
  loadUsers()
}

const handlePageChange = (val) => {
  page.value = val
  loadUsers()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  page.value = 1
  loadUsers()
}

const togglePermission = async (row) => {
  try {
    const nextValue = Number(row.publish_permission) === 1 ? 0 : 1
    const nextLabel = nextValue === 1 ? '开通' : '关闭'

    await ElMessageBox.confirm(
      `确认${nextLabel}用户 ${row.nickname || row.id} 的“我的发单”权限吗？`,
      '用户权限',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await updateMerchantUserPermission({
      user_id: row.id,
      publish_permission: nextValue
    })
    ElMessage.success('权限已更新')
    await loadUsers()
  } catch (error) {
    if (error?.action !== 'cancel' && error?.action !== 'close') {
      console.error('更新用户权限失败', error)
      ElMessage.error('权限更新失败')
    }
  }
}

const viewDetail = (row) => {
  ElMessageBox.alert(
    [
      `用户ID：${row.id}`,
      `昵称：${row.nickname || '-'}`,
      `手机号：${row.phone || '-'}`,
      `openid：${row.openid || '-'}`,
      `权限：${Number(row.publish_permission) === 1 ? '已开通' : '未开通'}`,
      `状态：${Number(row.status) === 1 ? '正常' : '禁用'}`,
      `注册时间：${formatTime(row.created_at) || '-'}`,
      `更新时间：${formatTime(row.updated_at) || '-'}`
    ].join('\n'),
    '用户详情',
    {
      confirmButtonText: '关闭',
      dangerouslyUseHTMLString: false
    }
  )
}

onMounted(() => {
  loadUsers()
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
  flex-wrap: wrap;
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

.filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-input {
  width: 280px;
}

.filter-select {
  width: 160px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-weight: 600;
  color: #0f172a;
}

.user-sub {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
