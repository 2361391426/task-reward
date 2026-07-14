const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  const startedAt = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - startedAt
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`)
  })
  next()
})

const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
app.use('/uploads', express.static(uploadsDir))

const { initDB } = require('./lib/db-json')
initDB()

const userRoutes = require('./api-local/user')
const taskRoutes = require('./api-local/tasks')
const submissionRoutes = require('./api-local/submissions')
const merchantRoutes = require('./api-local/merchant')
const uploadRoute = require('./api-local/upload')
const healthRoute = require('./api-local/health')

app.use('/api/user', userRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/submissions', submissionRoutes)
app.use('/api/merchant', merchantRoutes)
app.use('/api/upload', uploadRoute)
app.use('/api/health', healthRoute)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({
    code: 500,
    message: err.message || 'Server error',
    data: null
  })
})

app.listen(PORT, () => {
  console.log(`Local test server running at http://localhost:${PORT}`)
  console.log(`API health check: http://localhost:${PORT}/api/health`)
  console.log(`Uploads directory: ${uploadsDir}`)
})
