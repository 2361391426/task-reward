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
    return res.status(405).json(error(405, 'Method not allowed'))
  }

  try {
    await db.queryOne('SELECT 1 AS ok')

    return res.json(success({
      service: 'task-reward-api',
      status: 'healthy',
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      config: {
        jwt_secret_set: Boolean(process.env.JWT_SECRET),
        db_host_set: Boolean(process.env.DB_HOST),
        db_name_set: Boolean(process.env.DB_NAME)
      }
    }))
  } catch (err) {
    console.error('Health check failed:', err)
    return res.status(503).json(error(503, 'Service unhealthy'))
  }
}
