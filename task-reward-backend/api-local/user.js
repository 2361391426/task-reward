const express = require('express')
const router = express.Router()
const { query, execute } = require('../lib/db-local')
const { success, error } = require('../lib/response')
const jwt = require('jsonwebtoken')

// 模拟微信登录
router.post('/login', async (req, res) => {
  try {
    const { code } = req.body

    // 测试环境：使用 code 作为 openid
    const openid = code || 'test_openid_' + Date.now()

    // 查找或创建用户
    let users = await query('SELECT * FROM users WHERE openid = ?', [openid])
    let user

    if (users.length === 0) {
      // 创建新用户
      const result = await execute(
        'INSERT INTO users (openid, nickname, avatar) VALUES (?, ?, ?)',
        [openid, '测试用户', 'https://via.placeholder.com/100']
      )
      user = {
        id: result.insertId,
        openid,
        nickname: '测试用户',
        avatar: 'https://via.placeholder.com/100',
        balance: 0,
        total_earnings: 0
      }
    } else {
      user = users[0]
    }

    // 生成 token
    const token = jwt.sign(
      { userId: user.id, openid: user.openid },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json(success({ token, user }))
  } catch (err) {
    console.error('登录失败:', err)
    res.json(error('登录失败'))
  }
})

// 获取用户信息
router.get('/info', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.json(error('未登录', 401))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const users = await query('SELECT * FROM users WHERE id = ?', [decoded.userId])

    if (users.length === 0) {
      return res.json(error('用户不存在', 404))
    }

    res.json(success(users[0]))
  } catch (err) {
    console.error('获取用户信息失败:', err)
    res.json(error('获取用户信息失败'))
  }
})

// 获取收益信息
router.get('/earnings', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.json(error('未登录', 401))
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const users = await query('SELECT balance, total_earnings FROM users WHERE id = ?', [decoded.userId])

    if (users.length === 0) {
      return res.json(error('用户不存在', 404))
    }

    res.json(success(users[0]))
  } catch (err) {
    console.error('获取收益信息失败:', err)
    res.json(error('获取收益信息失败'))
  }
})

module.exports = router
