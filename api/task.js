import request from '../utils/request.js'

// 获取任务列表
export const getTaskList = (params) => {
  return request({
    url: '/tasks',
    method: 'GET',
    data: params
  })
}

// 获取任务详情
export const getTaskDetail = (id) => {
  return request({
    url: `/tasks/${id}`,
    method: 'GET'
  })
}

// 提交任务
export const submitTask = (data) => {
  return request({
    url: '/submissions',
    method: 'POST',
    data: data
  })
}

// 获取我的提交记录
export const getMySubmissions = () => {
  return request({
    url: '/submissions/my',
    method: 'GET'
  })
}

// 获取我的收益
export const getMyEarnings = () => {
  return request({
    url: '/user/earnings',
    method: 'GET'
  })
}
