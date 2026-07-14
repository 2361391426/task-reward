const fs = require('fs')
const path = require('path')

const success = (data, message = 'success') => ({
  code: 0,
  message,
  data
})

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      code: 405,
      message: 'Method not allowed',
      data: null
    })
  }

  const uploadsDir = path.join(__dirname, '../uploads')
  const dataFile = path.join(__dirname, '../data.json')

  return res.json(success({
    service: 'task-reward-local',
    status: 'healthy',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    storage: {
      data_file_exists: fs.existsSync(dataFile),
      uploads_dir_exists: fs.existsSync(uploadsDir)
    }
  }))
}
