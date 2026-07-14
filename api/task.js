import request from '../utils/request.js'

const CACHE_TTL = 30000
const cacheStore = new Map()

const makeKey = (name, params = {}) => `${name}:${JSON.stringify(params)}`

const cloneValue = (value) => {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value))
}

const getCached = (key) => {
  const entry = cacheStore.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cacheStore.delete(key)
    return null
  }
  return cloneValue(entry.value)
}

const setCached = (key, value) => {
  cacheStore.set(key, {
    timestamp: Date.now(),
    value: cloneValue(value)
  })
}

export const invalidateTaskCache = () => {
  cacheStore.clear()
}

export const getTaskList = (params, options = {}) => {
  const key = makeKey('task-list', params)
  if (!options.forceRefresh) {
    const cached = getCached(key)
    if (cached) return Promise.resolve(cached)
  }

  return request({
    url: '/tasks',
    method: 'GET',
    data: params
  }).then((res) => {
    setCached(key, res)
    return res
  })
}

export const getTaskDetail = (id) => {
  return request({
    url: `/tasks/${id}`,
    method: 'GET'
  })
}

export const submitTask = (data) => {
  return request({
    url: '/submissions',
    method: 'POST',
    data: data
  }).then((res) => {
    invalidateTaskCache()
    return res
  })
}

export const resubmitTask = (id, data) => {
  return request({
    url: `/submissions/${id}`,
    method: 'PUT',
    data: data
  }).then((res) => {
    invalidateTaskCache()
    return res
  })
}

export const getMySubmissions = (params = {}, options = {}) => {
  const key = makeKey('my-submissions', params)
  if (!options.forceRefresh) {
    const cached = getCached(key)
    if (cached) return Promise.resolve(cached)
  }

  return request({
    url: '/submissions/my',
    method: 'GET',
    data: params
  }).then((res) => {
    setCached(key, res)
    return res
  })
}

export const getSubmissionDetail = (id) => {
  return request({
    url: `/submissions/${id}`,
    method: 'GET'
  })
}

export const getMyEarnings = () => {
  return request({
    url: '/user/earnings',
    method: 'GET'
  })
}
