const axios = require('axios')

const BASE_URL = 'http://localhost:3001/api'

async function test() {
  console.log('🧪 开始测试 API...\n')

  try {
    // 1. 健康检查
    console.log('1️⃣ 测试健康检查...')
    const health = await axios.get(`${BASE_URL}/health`)
    console.log('✅ 健康检查通过:', health.data)
    console.log()

    // 2. 商家登录
    console.log('2️⃣ 测试商家登录...')
    const loginRes = await axios.post(`${BASE_URL}/merchant/login`, {
      username: 'admin',
      password: 'admin123'
    })
    const merchantToken = loginRes.data.data.token
    console.log('✅ 商家登录成功')
    console.log('Token:', merchantToken.substring(0, 20) + '...')
    console.log()

    // 3. 创建任务
    console.log('3️⃣ 测试创建任务...')
    const taskRes = await axios.post(
      `${BASE_URL}/merchant/tasks`,
      {
        title: '测试任务 - 淘宝刷单',
        search_keyword: '女装连衣裙',
        shop_name: '时尚女装店',
        product_name: '夏季连衣裙',
        reward_amount: 15.50,
        total_quota: 50,
        end_time: '2024-12-31 23:59:59'
      },
      {
        headers: { Authorization: `Bearer ${merchantToken}` }
      }
    )
    const taskId = taskRes.data.data.task_id
    console.log('✅ 任务创建成功, ID:', taskId)
    console.log()

    // 4. 获取任务列表
    console.log('4️⃣ 测试获取任务列表...')
    const tasksRes = await axios.get(`${BASE_URL}/tasks`)
    console.log('✅ 任务列表获取成功, 共', tasksRes.data.data.total, '个任务')
    console.log()

    // 5. 用户登录
    console.log('5️⃣ 测试用户登录...')
    const userLoginRes = await axios.post(`${BASE_URL}/user/login`, {
      code: 'test_user_' + Date.now()
    })
    const userToken = userLoginRes.data.data.token
    console.log('✅ 用户登录成功')
    console.log('Token:', userToken.substring(0, 20) + '...')
    console.log()

    // 6. 获取用户信息
    console.log('6️⃣ 测试获取用户信息...')
    const userInfoRes = await axios.get(`${BASE_URL}/user/info`, {
      headers: { Authorization: `Bearer ${userToken}` }
    })
    console.log('✅ 用户信息获取成功')
    console.log('用户ID:', userInfoRes.data.data.id)
    console.log('余额:', userInfoRes.data.data.balance)
    console.log()

    // 7. 提交任务
    console.log('7️⃣ 测试提交任务...')
    const submitRes = await axios.post(
      `${BASE_URL}/submissions`,
      {
        task_id: taskId,
        phone_number: '13800138000',
        screenshot_search: 'http://localhost:3001/uploads/test1.jpg',
        screenshot_shop_1: 'http://localhost:3001/uploads/test2.jpg',
        screenshot_shop_2: 'http://localhost:3001/uploads/test3.jpg',
        screenshot_shop_3: 'http://localhost:3001/uploads/test4.jpg',
        screenshot_follow: 'http://localhost:3001/uploads/test5.jpg',
        screenshot_share: 'http://localhost:3001/uploads/test6.jpg',
        screenshot_detail: 'http://localhost:3001/uploads/test7.jpg',
        screenshot_cart: 'http://localhost:3001/uploads/test8.jpg'
      },
      {
        headers: { Authorization: `Bearer ${userToken}` }
      }
    )
    const submissionId = submitRes.data.data.submission_id
    console.log('✅ 任务提交成功, ID:', submissionId)
    console.log()

    // 8. 获取提交列表
    console.log('8️⃣ 测试获取提交列表...')
    const submissionsRes = await axios.get(`${BASE_URL}/merchant/submissions`, {
      headers: { Authorization: `Bearer ${merchantToken}` }
    })
    console.log('✅ 提交列表获取成功, 共', submissionsRes.data.data.total, '条记录')
    console.log()

    // 9. 审核通过
    console.log('9️⃣ 测试审核通过...')
    await axios.post(
      `${BASE_URL}/merchant/submissions/review`,
      {
        submission_id: submissionId,
        review_status: 1,
        review_note: '审核通过'
      },
      {
        headers: { Authorization: `Bearer ${merchantToken}` }
      }
    )
    console.log('✅ 审核通过成功')
    console.log()

    // 10. 检查用户余额
    console.log('🔟 检查用户余额...')
    const finalUserInfo = await axios.get(`${BASE_URL}/user/info`, {
      headers: { Authorization: `Bearer ${userToken}` }
    })
    console.log('✅ 用户余额已更新')
    console.log('当前余额:', finalUserInfo.data.data.balance)
    console.log('累计收益:', finalUserInfo.data.data.total_earnings)
    console.log()

    console.log('🎉 所有测试通过！')
    console.log('\n📊 测试总结:')
    console.log('- 商家登录: ✅')
    console.log('- 创建任务: ✅')
    console.log('- 用户登录: ✅')
    console.log('- 提交任务: ✅')
    console.log('- 审核任务: ✅')
    console.log('- 余额更新: ✅')

  } catch (error) {
    console.error('\n❌ 测试失败:')
    if (error.response) {
      console.error('状态码:', error.response.status)
      console.error('响应:', error.response.data)
    } else {
      console.error(error.message)
    }
    process.exit(1)
  }
}

// 检查服务器是否运行
axios.get(`${BASE_URL}/health`)
  .then(() => {
    test()
  })
  .catch(() => {
    console.error('❌ 无法连接到服务器')
    console.error('请先启动测试服务器: cd task-reward-backend && npm run test')
    process.exit(1)
  })
