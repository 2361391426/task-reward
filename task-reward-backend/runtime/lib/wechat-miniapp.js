const axios = require('axios')

let cachedAccessToken = ''
let accessTokenExpiresAt = 0

const getAppConfig = () => {
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET || process.env.WECHAT_APPSECRET
  if (!appid || !secret) {
    throw new Error('WECHAT_APPID 和微信密钥未配置')
  }
  return { appid, secret }
}

const getAccessToken = async () => {
  if (cachedAccessToken && Date.now() < accessTokenExpiresAt - 5 * 60 * 1000) {
    return cachedAccessToken
  }

  const { appid, secret } = getAppConfig()
  const { data } = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    proxy: false,
    timeout: 10000,
    params: {
      grant_type: 'client_credential',
      appid,
      secret
    }
  })

  if (!data || data.errcode) {
    throw new Error(data?.errmsg || '获取微信 access_token 失败')
  }

  cachedAccessToken = data.access_token
  accessTokenExpiresAt = Date.now() + (Number(data.expires_in) || 7200) * 1000
  return cachedAccessToken
}

const getPhoneNumberFromCode = async (code) => {
  if (!code) {
    throw new Error('缺少手机号授权码')
  }

  const accessToken = await getAccessToken()
  const { data } = await axios.post(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
    { code },
    {
      proxy: false,
      timeout: 10000
    }
  )

  if (!data || data.errcode) {
    throw new Error(data?.errmsg || '获取手机号失败')
  }

  const phoneInfo = data.phone_info || {}
  const phoneNumber = phoneInfo.phoneNumber || phoneInfo.purePhoneNumber || ''
  if (!phoneNumber) {
    throw new Error('未返回手机号')
  }

  return {
    phoneNumber,
    countryCode: phoneInfo.countryCode || '',
    purePhoneNumber: phoneInfo.purePhoneNumber || phoneNumber
  }
}

module.exports = {
  getPhoneNumberFromCode
}
