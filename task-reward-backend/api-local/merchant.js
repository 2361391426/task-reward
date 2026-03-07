const express = require('express')
const router = express.Router()
const { query, execute } = require('../lib/db-local')
const { success, error } = require('../lib/response')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

// 商家登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    // 测试环境：简化密码验证
    if (username === 'admin' && password === 'admin123') {
      // 查找或创建商家
      let merchants = await query('SELECT * FROM merchants WHERE username = ?', [username])
      let merchant

      if (merchants.length === 0) {
        const hashedPassword = await bcrypt.hash(password, 10)
        const result = await execute(
          'INSERT INTO merchants (username, password, balance) VALUES (?, ?, ?)',
          [username, hashedPassword, 10000]
        )
        merchant = { id: result.insertId, username, balance: 10000 }
      } else {
        merchant = merchants[0]
      }

      const token = jwt.sign(
        { merchantId: merchant.id, username: merchant.username },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      )

      res.json(success({ token, merchant }))
    } else {
      res.json(error('用户名或密码错误'))
    }
  } catch (err) {
    console.error('登录失败:', err)
    res.json(error('登录失败'))
  }
})

// 获取任务列表
router.get('/tasks', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.json(error('未登录', 401))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { page = 1, page_size = 10 } = req.query

    const offset = (page - 1) * page_size
    const tasks = await query(
      `SELECT * FROM tasks WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [decoded.merchantId, parseInt(page_size), offset]
    )

    const totalResult = await query('SELECT COUNT(*) as total FROM tasks WHERE merchant_id = ?', [decoded.merchantId])
    const total = totalResult[0].total

    res.json(success({ list: tasks, total, page: parseInt(page), page_size: parseInt(page_size) }))
  } catch (err) {
    console.error('获取任务列表失败:', err)
    res.json(error('获取任务列表失败'))
  }
})

// 创建任务
router.post('/tasks', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.json(error('未登录', 401))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const {
      title,
      search_keyword,
      shop_name,
      product_name,
      reward_amount,
      total_quota,
      end_time
    } = req.body

    const result = await execute(
      `INSERT INTO tasks (
        merchant_id, title, search_keyword, shop_name, product_name,
        reward_amount, total_quota, end_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [decoded.merchantId, title, search_keyword, shop_name, product_name, reward_amount, total_quota, end_time]
    )

    res.json(success({ task_id: result.insertId }))
  } catch (err) {
    console.error('创建任务失败:', err)
    res.json(error('创建任务失败'))
  }
})

// 获取提交列表
router.get('/submissions', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.json(error('未登录', 401))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { page = 1, page_size = 10, review_status } = req.query

    let sql = `
      SELECT s.*, t.title as task_title, u.phone as user_phone
      FROM submissions s
      LEFT JOIN tasks t ON s.task_id = t.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE t.merchant_id = ?
    `
    const params = [decoded.merchantId]

    if (review_status !== undefined) {
      sql += ' AND s.review_status = ?'
      params.push(review_status)
    }

    sql += ' ORDER BY s.submit_time DESC LIMIT ? OFFSET ?'
    const offset = (page - 1) * page_size
    params.push(parseInt(page_size), offset)

    const submissions = await query(sql, params)

    let countSql = `
      SELECT COUNT(*) as total
      FROM submissions s
      LEFT JOIN tasks t ON s.task_id = t.id
      WHERE t.merchant_id = ?
    `
    const countParams = [decoded.merchantId]
    if (review_status !== undefined) {
      countSql += ' AND s.review_status = ?'
      countParams.push(review_status)
    }

    const totalResult = await query(countSql, countParams)
    const total = totalResult[0].total

    res.json(success({ list: submissions, total, page: parseInt(page), page_size: parseInt(page_size) }))
  } catch (err) {
    console.error('获取提交列表失败:', err)
    res.json(error('获取提交列表失败'))
  }
})

// 审核提交
router.post('/submissions/review', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.json(error('未登录', 401))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { submission_id, review_status, review_note } = req.body

    // 获取提交信息
    const submissions = await query(
      `SELECT s.*, t.merchant_id, t.reward_amount
       FROM submissions s
       LEFT JOIN tasks t ON s.task_id = t.id
       WHERE s.id = ?`,
      [submission_id]
    )

    if (submissions.length === 0) {
      return res.json(error('提交记录不存在'))
    }

    const submission = submissions[0]

    if (submission.merchant_id !== decoded.merchantId) {
      return res.json(error('无权限操作'))
    }

    // 更新审核状态
    await execute(
      `UPDATE submissions SET review_status = ?, review_note = ?, review_time = datetime('now') WHERE id = ?`,
      [review_status, review_note, submission_id]
    )

    // 如果通过，更新用户余额
    if (review_status === 1) {
      await execute(
        'UPDATE users SET balance = balance + ?, total_earnings = total_earnings + ? WHERE id = ?',
        [submission.reward_amount, submission.reward_amount, submission.user_id]
      )

      // 创建收益记录
      await execute(
        `INSERT INTO earnings (user_id, type, amount, balance, related_id, description)
         SELECT ?, 'task_reward', ?, balance, ?, ? FROM users WHERE id = ?`,
        [submission.user_id, submission.reward_amount, submission_id, '任务奖励', submission.user_id]
      )
    } else if (review_status === 2) {
      // 驳回，恢复任务名额
      await execute('UPDATE tasks SET used_quota = used_quota - 1 WHERE id = ?', [submission.task_id])
    }

    res.json(success({ message: '审核成功' }))
  } catch (err) {
    console.error('审核失败:', err)
    res.json(error('审核失败'))
  }
})

module.exports = router
