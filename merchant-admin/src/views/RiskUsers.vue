<template>
  <div class="page">
    <el-card class="card-panel">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">风险用户</div>
            <div class="subtitle">统一查看命中规则、拉黑原因和平台冷却状态</div>
          </div>
          <div class="filters">
            <el-input
              v-model="keyword"
              placeholder="搜索昵称 / 开放ID / 联合ID / 手机号"
              clearable
              class="filter-input"
              @keyup.enter="loadData"
            />
            <el-select v-model="status" placeholder="风险状态" clearable class="filter-select">
              <el-option label="全部" :value="''" />
              <el-option label="已拉黑" :value="1" />
              <el-option label="正常" :value="0" />
            </el-select>
            <el-button type="primary" @click="loadData">搜索</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="list" stripe border>
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar :size="42" :src="row.avatar">
                {{ row.nickname?.slice(0, 1) || 'U' }}
              </el-avatar>
              <div class="user-meta">
                <div class="user-name">{{ row.nickname || '未命名用户' }}</div>
                <div class="user-sub">openid: {{ row.openid || '-' }}</div>
                <div class="user-sub" v-if="row.unionid">unionid: {{ row.unionid }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="风险状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.risk_status === 1 ? 'danger' : 'success'">
              {{ row.risk_status === 1 ? '已拉黑' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="原因" min-width="260">
          <template #default="{ row }">
            <div class="wrap-text">{{ row.risk_reason || '-' }}</div>
          </template>
        </el-table-column>

        <el-table-column label="身份标签" min-width="180">
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

        <el-table-column label="冷却信息" min-width="260">
          <template #default="{ row }">
            <div class="cooldown-list">
              <div
                v-for="item in row.platform_cooldowns || []"
                :key="`${row.id}-${item.platform}`"
                class="cooldown-item"
              >
                <el-tag size="small">{{ platformLabel(item.platform) }}</el-tag>
                <span class="cooldown-text">{{ formatCooldown(item.cooldown_until, item.reason) }}</span>
              </div>
              <span v-if="!row.platform_cooldowns || row.platform_cooldowns.length === 0">-</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="统计" width="160">
          <template #default="{ row }">
            <div class="stats">
              <div>身份数量：{{ row.identity_count || 0 }}</div>
              <div>拉黑时间：{{ formatTime(row.blocked_at) || '-' }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button type="primary" link @click="openDetail(row)">详情</el-button>
              <el-button
                :type="row.risk_status === 1 ? 'success' : 'danger'"
                link
                @click="toggleRisk(row)"
              >
                {{ row.risk_status === 1 ? '解除' : '拉黑' }}
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
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRiskUsers, updateRiskUser } from '@/api/merchant'
import { formatTime } from '@/utils/format'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const status = ref('')

const tagLabel = (value) => {
  const map = {
    account: '账号',
    openid: '开放ID',
    unionid: '联合ID',
    phone: '手机号',
    ip: 'IP',
    device: '设备',
    address: '地址'
  }
  return map[value] || value
}

const platformLabel = (value) => {
  const map = {
    douyin: '抖音',
    xiaohongshu: '小红书',
    taobao: '淘宝',
    jd: '京东'
  }
  return map[value] || value
}

const formatCooldown = (until, reason) => {
  if (!until && !reason) return '-'
  const untilText = until ? formatTime(until) : ''
  return [untilText, reason].filter(Boolean).join(' / ')
}

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
  } catch (error) {
    console.error('加载风险用户失败', error)
    ElMessage.error('风险用户加载失败')
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

const openDetail = (row) => {
  const identities = row.identity_types?.map(tagLabel).join('，') || '-'
  const cooldowns = row.platform_cooldowns?.map((item) => {
    return `${platformLabel(item.platform)}: ${formatCooldown(item.cooldown_until, item.reason)}`
  }).join('\n') || '-'

  ElMessageBox.alert(
    [
      `用户ID：${row.id}`,
      `昵称：${row.nickname || '-'}`,
      `openid：${row.openid || '-'}`,
      `unionid：${row.unionid || '-'}`,
      `手机号：${row.phone || '-'}`,
      `风险状态：${row.risk_status === 1 ? '已拉黑' : '正常'}`,
      `原因：${row.risk_reason || '-'}`,
      `身份标签：${identities}`,
      `身份数量：${row.identity_count || 0}`,
      `冷却信息：\n${cooldowns}`
    ].join('\n'),
    '风险详情',
    {
      confirmButtonText: '关闭',
      dangerouslyUseHTMLString: false
    }
  )
}

const toggleRisk = async (row) => {
  try {
    if (row.risk_status === 1) {
      await ElMessageBox.confirm(
        `确认解除用户 ${row.nickname || row.id} 的拉黑吗？`,
        '解除拉黑',
        {
          type: 'warning',
          confirmButtonText: '解除',
          cancelButtonText: '取消'
        }
      )

      await updateRiskUser({
        user_id: row.id,
        status: 0,
        risk_reason: '',
        risk_tags: []
      })
      ElMessage.success('已解除拉黑')
      await loadData()
      return
    }

    const { value } = await ElMessageBox.prompt(
      '请输入拉黑原因，例如：IP / 设备 / 地址 / 账号 命中风控规则',
      '拉黑用户',
      {
        inputValue: row.risk_reason || '异常行为',
        confirmButtonText: '拉黑',
        cancelButtonText: '取消'
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
    ElMessage.success('已拉黑')
    await loadData()
  } catch (error) {
    if (error?.action !== 'cancel' && error?.action !== 'close') {
      console.error('更新风险用户失败', error)
      ElMessage.error('操作失败')
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
