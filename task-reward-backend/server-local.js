const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

const app = express()
const PORT = 3001

// 中间件
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静态文件服务（上传的图片）
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
app.use('/uploads', express.static(uploadsDir))

// 初始化数据库
const { initDB } = require('./lib/db-local')
initDB()

// 导入路由
const userRoutes = require('./api-local/user')
const taskRoutes = require('./api-local/tasks')
const submissionRoutes = require('./api-local/submissions')
const merchantRoutes = require('./api-local/merchant')
const uploadRoute = require('./api-local/upload')

// 注册路由
app.use('/api/user', userRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/submissions', submissionRoutes)
app.use('/api/merchant', merchantRoutes)
app.use('/api/upload', uploadRoute)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'OK', data: { status: 'healthy' } })
})

// 错误处理
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({
    code: 500,
    message: err.message || '服务器错误',
    data: null
  })
})

app.listen(PORT, () => {
  console.log(`🚀 本地测试服务器运行在 http://localhost:${PORT}`)
  console.log(`📝 API 文档: http://localhost:${PORT}/api/health`)
  console.log(`📁 上传目录: ${uploadsDir}`)
})
