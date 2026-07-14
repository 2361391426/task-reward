const assert = require('assert')
const axios = require('axios')

const BASE_URL = process.env.API_BASE || 'http://localhost:3001/api'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  validateStatus: () => true
})

const getResponseCode = (response) => response?.data?.code

const expectOk = (name, response) => {
  assert(response && response.data, `${name}: empty response`)
  assert.strictEqual(getResponseCode(response), 0, `${name}: expected success`)
  return response.data.data
}

const expectFailure = (name, response) => {
  assert(response && response.data, `${name}: empty response`)
  assert.notStrictEqual(getResponseCode(response), 0, `${name}: expected failure`)
  return response.data
}

const futureTime = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')

async function run() {
  console.log(`P2 regression target: ${BASE_URL}`)

  const health = await client.get('/health')
  expectOk('health', health)

  const merchantLogin = await client.post('/merchant/login', {
    username: 'admin',
    password: 'admin123'
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

  const submitPayload = {
    task_id: task.task_id,
    phone_number: '13800138000',
    paid_amount: 99,
    screenshot_search: 'https://example.com/1.jpg',
    screenshot_shop_1: 'https://example.com/2.jpg',
    screenshot_shop_2: 'https://example.com/3.jpg',
    screenshot_shop_3: 'https://example.com/4.jpg',
    screenshot_follow: 'https://example.com/5.jpg',
    screenshot_share: 'https://example.com/6.jpg',
    screenshot_detail: 'https://example.com/7.jpg',
    screenshot_cart: 'https://example.com/8.jpg'
  }

  const submitRes = await client.post('/submissions', submitPayload, {
    headers: { Authorization: `Bearer ${userToken}` }
  })
  const submission = expectOk('first submission', submitRes)
  assert(submission.submission_id, 'first submission: id missing')

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
    merchantTasks.list.some(item => item.id === task.task_id),
    'merchant tasks: created task not found'
  )

  console.log('P2 regression passed')
}

run().catch((error) => {
  if (error.response) {
    console.error('P2 regression failed with API response:')
    console.error(JSON.stringify(error.response.data, null, 2))
  } else {
    console.error('P2 regression failed:', error.message)
  }
  process.exit(1)
})
