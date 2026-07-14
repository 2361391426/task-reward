const express = require('express')
const router = express.Router()
const { query, queryOne, update } = require('../lib/db-json')

const success = (data) => ({ code: 0, data, message: 'success' })
const error = (message) => ({ code: -1, data: null, message })

const isTaskAvailable = (task, now = new Date()) => {
  if (parseInt(task.status, 10) !== 1) return false
  if ((task.used_quota || 0) >= (task.total_quota || 0)) return false
  if (task.start_time && new Date(task.start_time) > now) return false
  if (task.end_time && new Date(task.end_time) < now) return false
  return true
}

const syncExpiredTasks = () => {
  const tasks = query('tasks')
  const now = new Date()
  tasks
    .filter(task => {
      const status = parseInt(task.status, 10)
      if (status !== 1 && status !== 2) return false
      if (!task.end_time) return false
      return new Date(task.end_time) < now
    })
    .forEach(task => {
      update('tasks', { id: task.id }, { status: 3 })
    })
}

const normalizeTask = (task) => ({
  ...task,
  reward_amount: parseFloat(task.reward_amount || 0),
  platform: task.platform || 'taobao',
  status: parseInt(task.status, 10) || 1
})

const normalizeStatus = (value, fallback = 1) => {
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

router.get('/', async (req, res) => {
  try {
    syncExpiredTasks()
    const { page = 1, page_size = 10, status = 1, platform } = req.query

    const now = new Date()
    let tasks = query('tasks')
      .filter(item => normalizeStatus(item.status) === normalizeStatus(status))
      .filter(item => isTaskAvailable(item, now))

    if (platform) {
      tasks = tasks.filter(item => item.platform === platform)
    }

    tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const total = tasks.length
    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(page_size, 10) || 10, 1), 50)
    const offset = (pageNum - 1) * pageSize
    const list = tasks.slice(offset, offset + pageSize).map(normalizeTask)

    res.json(success({
      list,
      total,
      page: pageNum,
      page_size: pageSize
    }))
  } catch (err) {
    console.error('获取任务列表失败:', err)
    res.json(error('获取任务列表失败'))
  }
})

router.get('/:id', async (req, res) => {
  try {
    syncExpiredTasks()
    const { id } = req.params
    const task = queryOne('tasks', { id: parseInt(id) })

    if (!task) {
      return res.json(error('任务不存在'))
    }

    res.json(success(normalizeTask(task)))
  } catch (err) {
    console.error('获取任务详情失败:', err)
    res.json(error('获取任务详情失败'))
  }
})

module.exports = router
