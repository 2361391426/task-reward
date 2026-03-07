const express = require('express')
const router = express.Router()
const { query, execute } = require('../lib/db-local')
const { success, error } = require('../lib/response')
const jwt = require('jsonwebtoken')

// 提交任务
router.post('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.json(error('未登录', 401))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const {
      task_id,
      phone_number,
      screenshot_search,
      screenshot_shop_1,
      screenshot_shop_2,
      screenshot_shop_3,
      screenshot_follow,
      screenshot_share,
      screenshot_detail,
      screenshot_cart
    } = req.body

    // 检查任务是否存在
    const tasks = await query('SELECT * FROM tasks WHERE id = ?', [task_id])
    if (tasks.length === 0) {
      return res.json(error('任务不存在'))
    }

    const task = tasks[0]

    // 检查名额
    if (task.used_quota >= task.total_quota) {
      return res.json(error('任务名额已满'))
    }

    // 检查是否已提交
    const existing = await query(
      'SELECT * FROM submissions WHERE task_id = ? AND user_id = ?',
      [task_id, decoded.userId]
    )
    if (existing.length > 0) {
      return res.json(error('已提交过该任务'))
    }

    // 创建提交记录
    const result = await execute(
      `INSERT INTO submissions (
        task_id, user_id, phone_number,
        screenshot_search, screenshot_shop_1, screenshot_shop_2, screenshot_shop_3,
        screenshot_follow, screenshot_share, screenshot_detail, screenshot_cart
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task_id, decoded.userId, phone_number,
        screenshot_search, screenshot_shop_1, screenshot_shop_2, screenshot_shop_3,
        screenshot_follow, screenshot_share, screenshot_detail, screenshot_cart
      ]
    )

    // 更新任务名额
    await execute(
      'UPDATE tasks SET used_quota = used_quota + 1 WHERE id = ?',
      [task_id]
    )

    res.json(success({ submission_id: result.insertId }))
  } catch (err) {
    console.error('提交任务失败:', err)
    res.json(error('提交任务失败'))
  }
})

// 获取我的提交记录
router.get('/my', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.json(error('未登录', 401))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const submissions = await query(
      `SELECT s.*, t.title as task_title, t.reward_amount
       FROM submissions s
       LEFT JOIN tasks t ON s.task_id = t.id
       WHERE s.user_id = ?
       ORDER BY s.submit_time DESC`,
      [decoded.userId]
    )

    res.json(success({ list: submissions }))
  } catch (err) {
    console.error('获取提交记录失败:', err)
    res.json(error('获取提交记录失败'))
  }
})

module.exports = router
