const db = require('./db')

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

const notifySubmissionReviewed = async ({ userId, taskTitle, reviewStatus, rejectReason, rewardAmount }) => {
  const templateId = reviewStatus === 1
    ? process.env.WECHAT_TEMPLATE_SUBMISSION_APPROVED
    : process.env.WECHAT_TEMPLATE_SUBMISSION_REJECTED
  if (!templateId) return false

  const user = await db.queryOne('SELECT id, openid FROM users WHERE id = ?', [userId])
  if (!user?.openid) return false

  return sendTemplateMessage({
    openid: user.openid,
    templateId,
    page: 'pages/my/index',
    data: {
      thing1: { value: taskTitle || '任务提交' },
      phrase2: { value: reviewStatus === 1 ? '审核通过' : '审核驳回' },
      amount3: { value: `￥${Number(rewardAmount || 0).toFixed(2)}` },
      thing4: { value: rejectReason || '无' }
    }
  })
}

const notifyWithdrawalProcessed = async ({ userId, amount, status, rejectReason }) => {
  const templateId = process.env.WECHAT_TEMPLATE_WITHDRAWAL_PROCESSED
  if (!templateId) return false

  const user = await db.queryOne('SELECT id, openid FROM users WHERE id = ?', [userId])
  if (!user?.openid) return false

  return sendTemplateMessage({
    openid: user.openid,
    templateId,
    page: 'pages/my/index',
    data: {
      thing1: { value: status === 1 ? '提现已处理' : '提现已驳回' },
      amount2: { value: `￥${Number(amount || 0).toFixed(2)}` },
      thing3: { value: rejectReason || '无' }
    }
  })
}

module.exports = {
  getAccessToken,
  sendTemplateMessage,
  notifySubmissionReviewed,
  notifyWithdrawalProcessed
}
