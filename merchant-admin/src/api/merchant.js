import request from '@/utils/request'

export const login = (data) => request({
  url: '/merchant/login',
  method: 'POST',
  data
})

export const getTasks = (params) => request({
  url: '/merchant/tasks',
  method: 'GET',
  params
})

export const createTask = (data) => request({
  url: '/merchant/tasks',
  method: 'POST',
  data
})

export const updateTaskStatus = (data) => request({
  url: '/merchant/tasks',
  method: 'PATCH',
  data
})

export const updateTask = (data) => request({
  url: '/merchant/tasks',
  method: 'PUT',
  data
})

export const getSubmissions = (params) => request({
  url: '/merchant/submissions',
  method: 'GET',
  params
})

export const reviewSubmission = (data) => request({
  url: '/merchant/submissions/review',
  method: 'POST',
  data
})

export const getPlatformStats = (params) => request({
  url: '/merchant/stats',
  method: 'GET',
  params
})

export const getWithdrawals = (params) => request({
  url: '/merchant/withdrawals',
  method: 'GET',
  params
})

export const reviewWithdrawal = (data) => request({
  url: '/merchant/withdrawals',
  method: 'PATCH',
  data
})

export const getAuditLogs = (params) => request({
  url: '/merchant/audit-logs',
  method: 'GET',
  params
})

export const getRiskUsers = (params) => request({
  url: '/merchant/risk-users',
  method: 'GET',
  params
})

export const updateRiskUser = (data) => request({
  url: '/merchant/risk-users',
  method: 'PATCH',
  data
})

export const getRecharges = (params) => request({
  url: '/merchant/recharges',
  method: 'GET',
  params
})

export const createRecharge = (data) => request({
  url: '/merchant/recharges',
  method: 'POST',
  data
})
