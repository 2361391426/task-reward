import request from '@/utils/request'

// 商家登录
export const login = (data) => {
  return request({
    url: '/merchant/login',
    method: 'POST',
    data
  })
}

// 获取任务列表
export const getTasks = (params) => {
  return request({
    url: '/merchant/tasks',
    method: 'GET',
    params
  })
}

// 创建任务
export const createTask = (data) => {
  return request({
    url: '/merchant/tasks',
    method: 'POST',
    data
  })
}

// 获取提交列表
export const getSubmissions = (params) => {
  return request({
    url: '/merchant/submissions',
    method: 'GET',
    params
  })
}

// 审核提交
export const reviewSubmission = (data) => {
  return request({
    url: '/merchant/submissions/review',
    method: 'POST',
    data
  })
}
