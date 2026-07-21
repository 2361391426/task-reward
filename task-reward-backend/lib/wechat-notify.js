const db = require('./db')

const templateEnv = {
  taskStarted: ['WECHAT_TEMPLATE_TASK_STARTED', 'WECHAT_TEMPLATE_SUBMISSION_STARTED'],
  reviewApproved: ['WECHAT_TEMPLATE_TASK_REVIEW_APPROVED', 'WECHAT_TEMPLATE_SUBMISSION_APPROVED'],
  reviewRejected: ['WECHAT_TEMPLATE_TASK_REVIEW_REJECTED', 'WECHAT_TEMPLATE_SUBMISSION_REJECTED'],
  withdrawalProcessed: ['WECHAT_TEMPLATE_WITHDRAWAL_PROCESSED'],
  taskTimeout: ['WECHAT_TEMPLATE_TASK_TIMEOUT', 'WECHAT_TEMPLATE_SUBMISSION_TIMEOUT']
}

const pickTemplateId = (keys) => {
  for (const key of keys) {
    if (process.env[key]) {
      return process.env[key]
    }
  }
  return ''
}

const getAppConfig = () => {
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET || process.env.WECHAT_APPSECRET
  if (!appid || !secret) {
    return null
  }
  return { appid, secret }
}

const getAccessToken = async () => {
  const config = getAppConfig()
  if (!config) return null

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(config.appid)}&secret=${encodeURIComponent(config.secret)}`
  )
  const data = await response.json()
  if (!response.ok || data.errcode) {
    throw new Error(data.errmsg || '获取微信 access_token 失败')
  }
  return data.access_token
}

const sendTemplateMessage = async ({ openid, templateId, page, data }) => {
  if (!openid || !templateId) return false

  const accessToken = await getAccessToken()
  if (!accessToken) return false

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        touser: openid,
        template_id: templateId,
        page: page || 'pages/index/index',
        data: data || {}
      })
    }
  )

  const result = await response.json()
  if (result.errcode && result.errcode !== 0) {
    throw new Error(result.errmsg || '发送订阅消息失败')
  }

  return true
}

const getUserOpenid = async (userId) => {
  const user = await db.queryOne('SELECT id, openid FROM users WHERE id = ?', [userId])
  return user?.openid || ''
}

const notifyTaskStarted = async ({ userId, submissionId, taskTitle, expiresAt }) => {
  const templateId = pickTemplateId(templateEnv.taskStarted)
  if (!templateId) return false

  const openid = await getUserOpenid(userId)
  if (!openid) return false

  return sendTemplateMessage({
    openid,
    templateId,
    page: submissionId ? `pages/upload/index?id=${submissionId}` : 'pages/my/index',
    data: {
      thing1: { value: taskTitle || '体验项目' },
      phrase2: { value: '已开始' },
      time3: { value: expiresAt ? String(expiresAt).slice(0, 19).replace('T', ' ') : '请尽快提交' },
      thing4: { value: '请在 1 小时内提交凭证' }
    }
  })
}

const notifySubmissionReviewed = async ({ userId, taskTitle, reviewStatus, rejectReason, rewardAmount }) => {
  const templateId = reviewStatus === 1
    ? pickTemplateId(templateEnv.reviewApproved)
    : pickTemplateId(templateEnv.reviewRejected)
  if (!templateId) return false

  const openid = await getUserOpenid(userId)
  if (!openid) return false

  return sendTemplateMessage({
    openid,
    templateId,
    page: 'pages/my/index',
    data: {
      thing1: { value: taskTitle || '体验项目提交' },
      phrase2: { value: reviewStatus === 1 ? '审核通过' : '审核驳回' },
      amount3: { value: `${Number(rewardAmount || 0).toFixed(2)}积分` },
      thing4: { value: rejectReason || '无' }
    }
  })
}

const notifyWithdrawalProcessed = async ({ userId, amount, status, rejectReason }) => {
  const templateId = pickTemplateId(templateEnv.withdrawalProcessed)
  if (!templateId) return false

  const openid = await getUserOpenid(userId)
  if (!openid) return false

  return sendTemplateMessage({
    openid,
    templateId,
    page: 'pages/my/index',
    data: {
      thing1: { value: status === 1 ? '奖励结算已处理' : '奖励结算已驳回' },
      amount2: { value: `${Number(amount || 0).toFixed(2)}积分` },
      thing3: { value: rejectReason || '无' }
    }
  })
}

const notifyTaskTimeout = async ({ userId, taskTitle }) => {
  const templateId = pickTemplateId(templateEnv.taskTimeout)
  if (!templateId) return false

  const openid = await getUserOpenid(userId)
  if (!openid) return false

  return sendTemplateMessage({
    openid,
    templateId,
    page: 'pages/my/index',
    data: {
      thing1: { value: taskTitle || '体验项目' },
      phrase2: { value: '已超时释放' },
      thing3: { value: '今日不能再次参与同一项目' }
    }
  })
}

module.exports = {
  getAccessToken,
  sendTemplateMessage,
  notifyTaskStarted,
  notifySubmissionReviewed,
  notifyWithdrawalProcessed,
  notifyTaskTimeout
}
