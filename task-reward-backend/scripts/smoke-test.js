const assert = require('assert')
const axios = require('axios')

const BASE_URL = process.env.API_BASE || 'http://localhost:3001/api'
const MERCHANT_USERNAME = process.env.SMOKE_MERCHANT_USERNAME || process.env.ADMIN_USERNAME || 'admin'
const MERCHANT_PASSWORD = process.env.SMOKE_MERCHANT_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123'
const SKIP_AUTH = process.env.SMOKE_SKIP_AUTH === 'true'
const CRON_SECRET = process.env.TASK_LIFECYCLE_SWEEP_SECRET || ''

const client = axios.create({
  baseURL: BASE_URL,
  timeout: Number(process.env.SMOKE_TIMEOUT_MS || 15000),
  validateStatus: () => true,
  headers: {
    'x-forwarded-for': `10.251.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
    'x-device-id': `smoke-device-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
})

const expectOk = (name, response) => {
  assert(response && response.data, `${name}: 响应为空`)
  assert.strictEqual(response.data.code, 0, `${name}: 返回码异常 ${JSON.stringify(response.data)}`)
  return response.data.data
}

const printStep = (message) => console.log(`[冒烟测试] ${message}`)

async function run() {
  printStep(`目标接口：${BASE_URL}`)

  const health = await client.get('/health')
  const healthData = expectOk('健康检查', health)
  assert(healthData && healthData.status === 'healthy', '健康检查：服务状态异常')
  printStep('健康检查通过')

  if (CRON_SECRET) {
    const lifecycle = await client.post('/system/task-lifecycle', {}, {
      headers: { 'x-cron-secret': CRON_SECRET }
    })
    expectOk('生命周期同步', lifecycle)
    printStep('生命周期同步通过')
  } else {
    printStep('未配置 TASK_LIFECYCLE_SWEEP_SECRET，跳过生命周期同步')
  }

  if (SKIP_AUTH) {
    printStep('已跳过登录接口检查')
    printStep('冒烟测试通过')
    return
  }

  const merchantLogin = await client.post('/merchant/login', {
    username: MERCHANT_USERNAME,
    password: MERCHANT_PASSWORD
  })
  const merchantPayload = expectOk('商家登录', merchantLogin)
  assert(merchantPayload.token, '商家登录：缺少 token')
  const merchantToken = merchantPayload.token
  printStep('商家登录通过')

  const merchantTasks = await client.get('/merchant/tasks', {
    headers: { Authorization: `Bearer ${merchantToken}` }
  })
  const merchantTasksPayload = expectOk('商家任务列表', merchantTasks)
  assert(Array.isArray(merchantTasksPayload.list), '商家任务列表：缺少 list')
  printStep(`商家任务列表通过，共 ${merchantTasksPayload.list.length} 条`)

  const merchantTodos = await client.get('/merchant/todos', {
    headers: { Authorization: `Bearer ${merchantToken}` }
  })
  expectOk('商家待办', merchantTodos)
  printStep('商家待办通过')

  const userLogin = await client.post('/user/login', {
    code: `smoke_${Date.now()}`
  })
  const userPayload = expectOk('用户登录', userLogin)
  assert(userPayload.token, '用户登录：缺少 token')
  const userToken = userPayload.token
  printStep('用户登录通过')

  const userInfo = await client.get('/user/info', {
    headers: { Authorization: `Bearer ${userToken}` }
  })
  const userInfoPayload = expectOk('用户资料', userInfo)
  assert(userInfoPayload.id, '用户资料：缺少用户 ID')
  printStep('用户资料通过')

  const userTasks = await client.get('/tasks', {
    headers: { Authorization: `Bearer ${userToken}` },
    params: { page: 1, page_size: 5 }
  })
  const userTasksPayload = expectOk('任务大厅', userTasks)
  assert(Array.isArray(userTasksPayload.list), '任务大厅：缺少 list')
  printStep(`任务大厅通过，共 ${userTasksPayload.list.length} 条`)

  const withdrawals = await client.get('/user/withdrawals', {
    headers: { Authorization: `Bearer ${userToken}` },
    params: { page: 1, page_size: 5 }
  })
  const withdrawalsPayload = expectOk('奖励结算记录', withdrawals)
  assert(Array.isArray(withdrawalsPayload.list), '奖励结算记录：缺少 list')
  printStep(`奖励结算记录通过，共 ${withdrawalsPayload.list.length} 条`)

  printStep('冒烟测试通过')
}

run().catch((error) => {
  if (error.response) {
    console.error('冒烟测试失败，接口响应：')
    console.error(JSON.stringify(error.response.data, null, 2))
  } else {
    console.error('冒烟测试失败：', error.stack || error.message || error)
  }
  process.exit(1)
})
