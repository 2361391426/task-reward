<template>
  <div class="page">
    <div class="toolbar card">
      <div class="filters">
        <el-input
          v-model="keyword"
          placeholder="Search nickname / OpenID / UnionID / phone"
          clearable
          class="filter-input"
          @keyup.enter="loadData"
        />
        <el-select v-model="status" placeholder="Risk status" clearable class="filter-select">
          <el-option label="All" :value="''" />
          <el-option label="Blocked" :value="1" />
          <el-option label="Normal" :value="0" />
        </el-select>
        <el-button type="primary" @click="loadData">Search</el-button>
        <el-button @click="resetFilters">Reset</el-button>
      </div>
    </div>

    <div class="card table-card">
      <el-table v-loading="loading" :data="list" stripe border>
        <el-table-column label="User" min-width="220">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="42" :src="row.avatar">
                {{ row.nickname?.slice(0, 1) || 'U' }}
              </el-avatar>
              <div class="user-meta">
                <div class="user-name">{{ row.nickname || 'Unnamed' }}</div>
                <div class="user-sub">{{ row.openid }}</div>
                <div class="user-sub" v-if="row.unionid">{{ row.unionid }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Risk" width="120">
          <template #default="{ row }">
            <el-tag :type="row.risk_status === 1 ? 'danger' : 'success'">
              {{ row.risk_status === 1 ? 'Blocked' : 'Normal' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Reason" min-width="260">
          <template #default="{ row }">
            <div class="wrap-text">{{ row.risk_reason || '-' }}</div>
          </template>
        </el-table-column>

        <el-table-column label="Identity Tags" min-width="180">
          <template #default="{ row }">
            <div class="tag-wrap">
              <el-tag
                v-for="tag in row.identity_types || []"
                :key="tag"
                size="small"
                type="warning"
              >
                {{ tagLabel(tag) }}
              </el-tag>
              <span v-if="!row.identity_types || row.identity_types.length === 0">-</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Cooldown" min-width="260">
          <template #default="{ row }">
            <div class="cooldown-list">
              <div v-for="item in row.platform_cooldowns || []" :key="`${row.id}-${item.platform}`" class="cooldown-item">
                <el-tag size="small">{{ platformLabel(item.platform) }}</el-tag>
                <span class="cooldown-text">{{ formatCooldown(item.cooldown_until, item.reason) }}</span>
              </div>
              <span v-if="!row.platform_cooldowns || row.platform_cooldowns.length === 0">-</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Stats" width="140">
          <template #default="{ row }">
            <div class="stats">
              <div>Identity count: {{ row.identity_count || 0 }}</div>
              <div>Blocked at: {{ formatTime(row.blocked_at) || '-' }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="180" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button type="primary" link @click="openDetail(row)">Detail</el-button>
              <el-button
                :type="row.risk_status === 1 ? 'success' : 'danger'"
                link
                @click="toggleRisk(row)"
              >
                {{ row.risk_status === 1 ? 'Unblock' : 'Block' }}
              </el-button>
            </el-space>
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
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRiskUsers, updateRiskUser } from '@/api/merchant'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const status = ref('')

const loadData = async () => {
  loading.value = true
  try {
    const res = await getRiskUsers({
      page: page.value,
      page_size: pageSize.value,
      keyword: keyword.value,
      status: status.value
    })
    list.value = res?.list || []
    total.value = res?.total || 0
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  keyword.value = ''
  status.value = ''
  page.value = 1
  loadData()
}

const handlePageChange = (val) => {
  page.value = val
  loadData()
}

const handleSizeChange = (val) => {
  pageSize.value = val
  page.value = 1
  loadData()
}

const tagLabel = (value) => {
  const map = {
    account: 'Account',
    openid: 'OpenID',
    unionid: 'UnionID',
    phone: 'Phone',
    ip: 'IP',
    device: 'Device',
    address: 'Address'
  }
  return map[value] || value
}

const platformLabel = (value) => {
  const map = {
    douyin: 'Douyin',
    xiaohongshu: 'Xiaohongshu',
    taobao: 'Taobao',
    jd: 'JD'
  }
  return map[value] || value
}

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN')
}

const formatCooldown = (until, reason) => {
  if (!until && !reason) return '-'
  const untilText = until ? formatTime(until) : ''
  return [untilText, reason].filter(Boolean).join(' / ')
}

const openDetail = (row) => {
  const identities = row.identity_types?.map(tagLabel).join(', ') || '-'
  const cooldowns = row.platform_cooldowns?.map(item => {
    return `${platformLabel(item.platform)}: ${formatCooldown(item.cooldown_until, item.reason)}`
  }).join('\n') || '-'

  ElMessageBox.alert(
    [
      `User ID: ${row.id}`,
      `Nickname: ${row.nickname || '-'}`,
      `OpenID: ${row.openid || '-'}`,
      `UnionID: ${row.unionid || '-'}`,
      `Phone: ${row.phone || '-'}`,
      `Risk: ${row.risk_status === 1 ? 'Blocked' : 'Normal'}`,
      `Reason: ${row.risk_reason || '-'}`,
      `Identity tags: ${identities}`,
      `Identity count: ${row.identity_count || 0}`,
      `Cooldown:\n${cooldowns}`
    ].join('\n'),
    'Risk detail',
    {
      confirmButtonText: 'Close',
      dangerouslyUseHTMLString: false
    }
  )
}

const toggleRisk = async (row) => {
  try {
    if (row.risk_status === 1) {
      await ElMessageBox.confirm(`Unblock user ${row.nickname || row.id}?`, 'Unblock', {
        type: 'warning',
        confirmButtonText: 'Unblock',
        cancelButtonText: 'Cancel'
      })
      await updateRiskUser({
        user_id: row.id,
        status: 0,
        risk_reason: '',
        risk_tags: []
      })
      ElMessage.success('Unblocked')
      loadData()
      return
    }

    const { value } = await ElMessageBox.prompt(
      'Enter a reason for blocking. Mention IP / device / address / account if applicable.',
      'Block user',
      {
        inputValue: row.risk_reason || 'Abnormal behavior',
        confirmButtonText: 'Block',
        cancelButtonText: 'Cancel'
      }
    )

    const tags = []
    const text = String(value || '').toLowerCase()
    if (text.includes('ip')) tags.push('ip')
    if (text.includes('device')) tags.push('device')
    if (text.includes('address')) tags.push('address')
    if (text.includes('account') || text.includes('openid') || text.includes('unionid')) tags.push('account')
    if (text.includes('phone')) tags.push('phone')

    await updateRiskUser({
      user_id: row.id,
      status: 1,
      risk_reason: value,
      risk_tags: tags
    })
    ElMessage.success('Blocked')
    loadData()
  } catch (error) {
    if (error?.action !== 'cancel' && error?.action !== 'close') {
      console.error('Failed to update risk state', error)
      ElMessage.error('Operation failed')
    }
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar,
.table-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
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

.user-sub,
.wrap-text,
.stats,
.cooldown-text {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.wrap-text {
  white-space: normal;
  word-break: break-all;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cooldown-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cooldown-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
