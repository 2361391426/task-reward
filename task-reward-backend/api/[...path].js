const express = require('express')
const cors = require('cors')

const app = express()

app.disable('x-powered-by')
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

const route = (path, handler) => {
  app.all(path, handler)
}

const health = require('../runtime/api/health')
const upload = require('../runtime/api/upload')
const userLogin = require('../runtime/api/user/login')
const userInfo = require('../runtime/api/user/info')
const userPhone = require('../runtime/api/user/phone')
const userEarnings = require('../runtime/api/user/earnings')
const userWithdrawals = require('../runtime/api/user/withdrawals')
const tasksIndex = require('../runtime/api/tasks/index')
const tasksId = require('../runtime/api/tasks/[id]')
const submissionsIndex = require('../runtime/api/submissions/index')
const submissionsMy = require('../runtime/api/submissions/my')
const submissionsId = require('../runtime/api/submissions/[id]')
const feedbacksIndex = require('../runtime/api/feedbacks/index')
const systemTaskLifecycle = require('../runtime/api/system/task-lifecycle')
const merchantLogin = require('../runtime/api/merchant/login')
const merchantTasks = require('../runtime/api/merchant/tasks/index')
const merchantSubmissions = require('../runtime/api/merchant/submissions/index')
const merchantSubmissionReview = require('../runtime/api/merchant/submissions/review')
const merchantUsers = require('../runtime/api/merchant/users/index')
const merchantStaffs = require('../runtime/api/merchant/staffs/index')
const merchantWithdrawals = require('../runtime/api/merchant/withdrawals/index')
const merchantRecharges = require('../runtime/api/merchant/recharges/index')
const merchantStats = require('../runtime/api/merchant/stats/index')
const merchantTodos = require('../runtime/api/merchant/todos')
const merchantRiskUsers = require('../runtime/api/merchant/risk-users/index')
const merchantAuditLogs = require('../runtime/api/merchant/audit-logs/index')
const merchantFeedbacks = require('../runtime/api/merchant/feedbacks/index')

route('/api/health', health)
route('/api/upload', upload)

route('/api/user/login', userLogin)
route('/api/user/info', userInfo)
route('/api/user/phone', userPhone)
route('/api/user/earnings', userEarnings)
route('/api/user/withdrawals', userWithdrawals)

route('/api/tasks', tasksIndex)
route('/api/tasks/:id', tasksId)

route('/api/submissions', submissionsIndex)
route('/api/submissions/my', submissionsMy)
route('/api/submissions/:id', submissionsId)

route('/api/feedbacks', feedbacksIndex)

route('/api/system/task-lifecycle', systemTaskLifecycle)

route('/api/merchant/login', merchantLogin)
route('/api/merchant/tasks', merchantTasks)
route('/api/merchant/submissions', merchantSubmissions)
route('/api/merchant/submissions/review', merchantSubmissionReview)
route('/api/merchant/users', merchantUsers)
route('/api/merchant/staffs', merchantStaffs)
route('/api/merchant/withdrawals', merchantWithdrawals)
route('/api/merchant/recharges', merchantRecharges)
route('/api/merchant/stats', merchantStats)
route('/api/merchant/todos', merchantTodos)
route('/api/merchant/risk-users', merchantRiskUsers)
route('/api/merchant/audit-logs', merchantAuditLogs)
route('/api/merchant/feedbacks', merchantFeedbacks)

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: 'Not found',
    data: null
  })
})

module.exports = app
