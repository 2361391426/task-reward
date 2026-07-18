import request from '../utils/request.js'

export const getMerchantTasks = (params = {}) => {
  return request({
    url: '/merchant/tasks',
    method: 'GET',
    data: params
  })
}

export const getMerchantSubmissions = (params = {}) => {
  return request({
    url: '/merchant/submissions',
    method: 'GET',
    data: params
  })
}

export const reviewMerchantSubmission = (data = {}) => {
  return request({
    url: '/merchant/submissions/review',
    method: 'POST',
    data
  })
}

export const getMerchantFeedbacks = (params = {}) => {
  return request({
    url: '/merchant/feedbacks',
    method: 'GET',
    data: params
  })
}

export const replyMerchantFeedback = (data = {}) => {
  return request({
    url: '/merchant/feedbacks',
    method: 'POST',
    data
  })
}
