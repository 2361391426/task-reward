const assert = require('assert')
const axios = require('axios')

const BASE_URL = process.env.API_BASE || 'http://localhost:3001/api'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000
})

const expectOk = (name, response) => {
  assert(response && response.data, `${name}: empty response`)
  assert.strictEqual(response.data.code, 0, `${name}: unexpected code ${response.data.code}`)
  return response.data.data
}

async function run() {
  console.log(`Smoke test target: ${BASE_URL}`)

  const health = await client.get('/health')
  const healthData = expectOk('health', health)
  assert(healthData && healthData.status === 'healthy', 'health: service not healthy')
  console.log('health ok')

  const merchantLogin = await client.post('/merchant/login', {
    username: 'admin',
    password: 'admin123'
  })
  const merchantPayload = expectOk('merchant login', merchantLogin)
  assert(merchantPayload.token, 'merchant login: token missing')
  const merchantToken = merchantPayload.token
  console.log('merchant login ok')

  const merchantTasks = await client.get('/merchant/tasks', {
    headers: { Authorization: `Bearer ${merchantToken}` }
  })
  const merchantTasksPayload = expectOk('merchant tasks', merchantTasks)
  assert(Array.isArray(merchantTasksPayload.list), 'merchant tasks: list missing')
  console.log(`merchant tasks ok (${merchantTasksPayload.list.length} rows)`)

  const userLogin = await client.post('/user/login', {
    code: `smoke_${Date.now()}`
  })
  const userPayload = expectOk('user login', userLogin)
  assert(userPayload.token, 'user login: token missing')
  const userToken = userPayload.token
  console.log('user login ok')

  const userInfo = await client.get('/user/info', {
    headers: { Authorization: `Bearer ${userToken}` }
  })
  const userInfoPayload = expectOk('user info', userInfo)
  assert(typeof userInfoPayload.id === 'number', 'user info: id missing')
  console.log('user info ok')

  const userTasks = await client.get('/tasks', {
    headers: { Authorization: `Bearer ${userToken}` },
    params: { page: 1, page_size: 5 }
  })
  const userTasksPayload = expectOk('tasks list', userTasks)
  assert(Array.isArray(userTasksPayload.list), 'tasks list: list missing')
  console.log(`tasks list ok (${userTasksPayload.list.length} rows)`)

  const withdrawals = await client.get('/user/withdrawals', {
    headers: { Authorization: `Bearer ${userToken}` },
    params: { page: 1, page_size: 5 }
  })
  const withdrawalsPayload = expectOk('withdrawals list', withdrawals)
  assert(Array.isArray(withdrawalsPayload.list), 'withdrawals list: list missing')
  console.log(`withdrawals list ok (${withdrawalsPayload.list.length} rows)`)

  console.log('Smoke test passed')
}

run().catch((error) => {
  if (error.response) {
    console.error('Smoke test failed with API response:')
    console.error(JSON.stringify(error.response.data, null, 2))
  } else {
    console.error('Smoke test failed:', error.message)
  }
  process.exit(1)
})
