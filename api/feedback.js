import request from '../utils/request.js'

export const getMyFeedbacks = () => {
  return request({
    url: '/feedbacks',
    method: 'GET'
  })
}

export const submitFeedback = (data = {}) => {
  return request({
    url: '/feedbacks',
    method: 'POST',
    data
  })
}
