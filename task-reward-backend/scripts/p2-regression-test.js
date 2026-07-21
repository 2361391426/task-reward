const assert = require('assert')
const axios = require('axios')

const BASE_URL = process.env.API_BASE || 'http://localhost:3001/api'
const MERCHANT_USERNAME = process.env.P2_MERCHANT_USERNAME || process.env.ADMIN_USERNAME || 'admin'
const MERCHANT_PASSWORD = process.env.P2_MERCHANT_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123'
const STRICT_PRODUCTION = process.env.P2_STRICT_PRODUCTION === 'true'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  validateStatus: () => true,
  headers: {
    'x-forwarded-for': `10.250.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
    'x-device-id': `p2-device-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
})

const getResponseCode = (response) => response?.data?.code

const expectOk = (name, response) => {
  assert(response && response.data, `${name}: empty response`)
  assert.strictEqual(getResponseCode(response), 0, `${name}: expected success, got ${JSON.stringify(response.data)}`)
  return response.data.data
}

const expectFailure = (name, response) => {
  assert(response && response.data, `${name}: empty response`)
  assert.notStrictEqual(getResponseCode(response), 0, `${name}: expected failure, got ${JSON.stringify(response.data)}`)
  return response.data
}

const futureTime = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
const makeTestPhone = () => `139${String(Date.now()).slice(-8)}`

async function run() {
  console.log(`P2 regression target: ${BASE_URL}`)
  if (STRICT_PRODUCTION && BASE_URL.includes('localhost')) {
    throw new Error('P2_STRICT_PRODUCTION=true 时必须设置 API_BASE 为生产接口地址')
  }

  const health = await client.get('/health')
  expectOk('health', health)

  const merchantLogin = await client.post('/merchant/login', {
    username: MERCHANT_USERNAME,
    password: MERCHANT_PASSWORD
  })
  const merchant = expectOk('merchant login', merchantLogin)
  const merchantToken = merchant.token
  assert(merchantToken, 'merchant login: token missing')

  const userLogin = await client.post('/user/login', {
    code: `p2_${Date.now()}`
  })
  const user = expectOk('user login', userLogin)
  const userToken = user.token
  assert(userToken, 'user login: token missing')

  const anonymousUpload = await client.post('/upload')
  expectFailure('anonymous upload', anonymousUpload)

  const invalidWithdrawal = await client.post('/user/withdrawals', {
    amount: -1,
    withdraw_type: 1,
    account_info: 'bad'
  }, {
    headers: { Authorization: `Bearer ${userToken}` }
  })
  expectFailure('invalid withdrawal', invalidWithdrawal)

  const createTaskRes = await client.post('/merchant/tasks', {
    platform: 'taobao',
    title: `P2 回归任务 ${Date.now()}`,
    search_keyword: '测试关键词',
    shop_name: '测试店铺',
    product_name: '测试商品',
    reward_amount: 1,
    total_quota: 1,
    end_time: futureTime()
  }, {
    headers: { Authorization: `Bearer ${merchantToken}` }
  })
  const task = expectOk('create task', createTaskRes)
  assert(task.task_id, 'create task: task_id missing')

  const startTask = await client.post(`/tasks/${task.task_id}`, {}, {
    headers: { Authorization: `Bearer ${userToken}` }
  })
  const started = expectOk('start task', startTask)
  assert(started.submission_id, 'start task: submission_id missing')

  const submitPayload = {
    task_id: task.task_id,
    wechat_id: `p2_wechat_${Date.now()}`,
    phone_number: makeTestPhone(),
    paid_amount: 99,
    order_number: `P2${Date.now()}`,
    screenshot_search: 'https://example.com/1.jpg',
    screenshot_shop_1: 'https://example.com/2.jpg',
    screenshot_shop_2: 'https://example.com/3.jpg',
    screenshot_shop_3: 'https://example.com/4.jpg',
    screenshot_follow: 'https://example.com/5.jpg',
    screenshot_share: 'https://example.com/6.jpg',
    screenshot_detail: 'https://example.com/7.jpg',
    screenshot_cart: 'https://example.com/8.jpg',
    screenshot_paid_order: 'https://example.com/9.jpg'
  }

  const submitRes = await client.post('/submissions', submitPayload, {
    headers: { Authorization: `Bearer ${userToken}` }
  })
  const submission = expectOk('first submission', submitRes)
  assert.strictEqual(
    String(submission.submission_id),
    String(started.submission_id),
    'first submission: should submit the active claim'
  )

  const duplicateSubmit = await client.post('/submissions', submitPayload, {
    headers: { Authorization: `Bearer ${userToken}` }
  })
  expectFailure('duplicate submission', duplicateSubmit)

  const merchantTaskList = await client.get('/merchant/tasks', {
    headers: { Authorization: `Bearer ${merchantToken}` }
  })
  const merchantTasks = expectOk('merchant tasks', merchantTaskList)
  assert(Array.isArray(merchantTasks.list), 'merchant tasks: list missing')
  assert(
    merchantTasks.list.some(item => String(item.id) === String(task.task_id)),
    'merchant tasks: created task not found'
  )

  console.log('P2 regression passed')
}

run().catch((error) => {
  if (error.response) {
    console.error('P2 regression failed with API response:')
    console.error(JSON.stringify(error.response.data, null, 2))
  } else {
    console.error('P2 regression failed:', error.stack || error.message || error)
  }
  process.exit(1)
})
