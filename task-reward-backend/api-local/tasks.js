const express = require('express')
const router = express.Router()
const { query } = require('../lib/db-local')
const { success, error } = require('../lib/response')

// 获取任务列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, page_size = 10, status = 1 } = req.query

    const offset = (page - 1) * page_size
    const tasks = await query(
      `SELECT t.*, m.username as merchant_name
       FROM tasks t
       LEFT JOIN merchants m ON t.merchant_id = m.id
       WHERE t.status = ?
       ORDER BY t.created_at DESC
       LIMIT ? OFFSET ?`,
      [status, parseInt(page_size), offset]
    )

    const totalResult = await query('SELECT COUNT(*) as total FROM tasks WHERE status = ?', [status])
    const total = totalResult[0].total

    res.json(success({
      list: tasks,
      total,
      page: parseInt(page),
      page_size: parseInt(page_size)
    }))
  } catch (err) {
    console.error('获取任务列表失败:', err)
    res.json(error('获取任务列表失败'))
  }
})

// 获取任务详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const tasks = await query('SELECT * FROM tasks WHERE id = ?', [id])

    if (tasks.length === 0) {
      return res.json(error('任务不存在', 404))
    }

    res.json(success(tasks[0]))
  } catch (err) {
    console.error('获取任务详情失败:', err)
    res.json(error('获取任务详情失败'))
  }
})

module.exports = router
