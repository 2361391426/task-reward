import request from '../utils/request.js'

// 微信登录
export const wxLogin = (code) => {
  return request({
    url: '/user/login',
    method: 'POST',
    data: { code }
  })
}

// 获取用户信息
export const getUserInfo = () => {
  return request({
    url: '/user/info',
    method: 'GET'
  })
}

// 获取收益信息
export const getEarnings = () => {
  return request({
    url: '/user/earnings',
    method: 'GET'
  })
}
