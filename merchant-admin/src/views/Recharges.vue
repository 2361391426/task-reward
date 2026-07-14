<template>
  <div class="recharges-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="title-block">
            <span>充值管理</span>
            <span class="subtitle">充值后余额实时入账，用于支撑任务发布与结算。</span>
          </div>
          <div class="toolbar">
            <el-select v-model="filterStatus" placeholder="全部状态" clearable style="width: 140px" @change="resetAndLoad">
              <el-option label="已入账" :value="1" />
            </el-select>
            <el-button type="primary" @click="showDialog = true">
              <el-icon><Coin /></el-icon>
              发起充值
            </el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="info"
        show-icon
        :closable="false"
        class="balance-alert"
        title="当前账户余额"
      >
        <template #default>
          <div class="balance-row">
            <strong>¥{{ currentBalance }}</strong>
            <span>充值成功后会立即同步到商家账户余额。</span>
          </div>
        </template>
      </el-alert>

      <el-table :data="rechargeList" v-loading="loading" class="table">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="amount" label="充值金额" width="120">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="payment_method" label="支付方式" width="120">
          <template #default="{ row }">{{ paymentMethodText(row.payment_method) }}</template>
        </el-table-column>
        <el-table-column prop="transaction_no" label="交易单号" min-width="200" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column prop="updated_at" label="更新时间" width="180" />
      </el-table>

      <div v-if="!loading && rechargeList.length === 0" class="empty-state">暂无充值记录</div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :total="pagination.total"
          layout="total, prev, pager, next"
          @current-change="loadRecharges"
        />
      </div>
    </el-card>

    <el-dialog v-model="showDialog" title="发起充值" width="520px" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="充值金额" prop="amount">
          <el-input-number v-model="form.amount" :min="1" :step="100" :precision="2" style="width: 100%" />
        </el-form-item>

        <el-form-item label="支付方式" prop="payment_method">
          <el-select v-model="form.payment_method" placeholder="请选择支付方式" style="width: 100%">
            <el-option label="微信支付" :value="1" />
            <el-option label="支付宝" :value="2" />
            <el-option label="银行卡" :value="3" />
          </el-select>
        </el-form-item>

        <el-form-item label="交易单号" prop="transaction_no">
          <el-input v-model="form.transaction_no" placeholder="可留空，系统自动生成" />
        </el-form-item>

        <el-form-item label="备注" prop="note">
          <el-input
            v-model="form.note"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="可补充充值说明"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确认充值</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Coin } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { createRecharge, getRecharges } from '@/api/merchant'
import { paymentMethodText, rechargeStatusTagType, rechargeStatusText } from '@/utils/format'

const authStore = useAuthStore()
const loading = ref(false)
const submitting = ref(false)
const showDialog = ref(false)
const filterStatus = ref(1)
const rechargeList = ref([])
const formRef = ref(null)

const pagination = reactive({
  page: 1,
  page_size: 10,
  total: 0
})

const currentBalance = computed(() => {
  const balance = Number(authStore.userInfo?.balance || 0)
  return balance.toFixed(2)
})

const createForm = () => ({
  amount: 100,
  payment_method: 1,
  transaction_no: '',
  note: ''
})

const form = reactive(createForm())

const rules = {
  amount: [{ required: true, message: '请输入充值金额', trigger: 'blur' }],
  payment_method: [{ required: true, message: '请选择支付方式', trigger: 'change' }]
}

const statusText = (status) => rechargeStatusText(status)

const statusTagType = (status) => rechargeStatusTagType(status)

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

const loadRecharges = async () => {
  try {
    loading.value = true
    const res = await getRecharges(buildParams())
    rechargeList.value = res.list || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('加载充值列表失败', error)
  } finally {
    loading.value = false
  }
}

const resetAndLoad = () => {
  pagination.page = 1
  loadRecharges()
}

const resetForm = () => {
  Object.assign(form, createForm())
}

const handleSubmit = async () => {
  try {
    await formRef.value.validate()
    submitting.value = true

    const payload = {
      amount: Number(form.amount),
      payment_method: form.payment_method,
      transaction_no: form.transaction_no,
      note: form.note
    }

    await createRecharge(payload)

    const nextBalance = Number(authStore.userInfo?.balance || 0) + Number(payload.amount || 0)
    authStore.setUserInfo({
      ...authStore.userInfo,
      balance: Number(nextBalance.toFixed(2))
    })

    ElMessage.success('充值已入账')
    showDialog.value = false
    resetForm()
    loadRecharges()
  } catch (error) {
    if (error !== false) {
      console.error('发起充值失败', error)
    }
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadRecharges()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subtitle {
  font-size: 12px;
  color: #909399;
}

.toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.balance-alert {
  margin-bottom: 16px;
}

.balance-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.table {
  margin-top: 8px;
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
