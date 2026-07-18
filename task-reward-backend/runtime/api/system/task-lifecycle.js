const db = require('../../lib/db')
const { success, error } = require('../../lib/response')
const { syncExpiredTasks } = require('../../lib/task-lifecycle')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Cron-Secret')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json(error(405, 'Method not allowed'))
  }

  const configuredSecret = process.env.TASK_LIFECYCLE_SWEEP_SECRET
  const requestSecret = req.headers['x-cron-secret'] || req.query.secret || req.body?.secret
  if (configuredSecret && requestSecret !== configuredSecret) {
    return res.status(403).json(error(403, 'Forbidden'))
  }
  if (!configuredSecret && ['production', 'prod'].includes(String(process.env.NODE_ENV || '').toLowerCase())) {
    return res.status(403).json(error(403, 'Cron secret not configured'))
  }

  try {
    const result = await db.transaction(async (connection) => {
      return syncExpiredTasks(connection)
    })

    return res.json(success({ expired_count: Number(result || 0) }, '任务状态已同步'))
  } catch (err) {
    console.error('Task lifecycle sweep failed:', err)
    return res.status(500).json(error(500, '服务器错误'))
  }
}
