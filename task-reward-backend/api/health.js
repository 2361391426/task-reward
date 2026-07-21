const db = require('../lib/db')
const { success, error } = require('../lib/response')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json(error(405, '请求方法不支持'))
  }

  try {
    await db.queryOne('SELECT 1 AS ok')

    return res.json(success({
      service: 'task-reward-api',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }))
  } catch (err) {
    console.error('Health check failed:', err)
    return res.status(503).json(error(503, '服务暂不可用'))
  }
}
