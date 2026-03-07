// 测试 API 连接
const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function testAPIs() {
  console.log('🧪 开始测试 API...\n');

  try {
    // 1. 测试任务列表
    console.log('1️⃣ 测试任务列表...');
    const tasksRes = await axios.get(`${API_BASE}/tasks`);
    console.log('✅ 任务列表:', tasksRes.data);
    console.log('');

    // 2. 测试商家登录
    console.log('2️⃣ 测试商家登录...');
    const loginRes = await axios.post(`${API_BASE}/merchant/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ 登录成功:', loginRes.data);
    const merchantToken = loginRes.data.data.token;
    console.log('');

    // 3. 测试获取商家任务列表
    console.log('3️⃣ 测试商家任务列表...');
    const merchantTasksRes = await axios.get(`${API_BASE}/merchant/tasks`, {
      headers: {
        Authorization: `Bearer ${merchantToken}`
      }
    });
    console.log('✅ 商家任务列表:', merchantTasksRes.data);
    console.log('');

    console.log('🎉 所有测试通过！');
  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

testAPIs();
