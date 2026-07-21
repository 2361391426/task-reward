const db = require('../../lib/db')
const cache = require('../../lib/cache')
const { success, error } = require('../../lib/response')
const { normalizePagination, parsePositiveInt } = require('../../lib/pagination')
const { normalizeTaskRecord } = require('../../lib/task-lifecycle')

const normalizePlatform = (value) => {
  const platforms = ['douyin', 'xiaohongshu', 'taobao', 'jd']
  return platforms.includes(value) ? value : 'taobao'
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json(error(405, '请求方法不支持'))
  }

  try {
    const { page, page_size, platform } = req.query
    const rawStatus = req.query.status
    const { page: currentPage, pageSize, offset } = normalizePagination(
      { page, page_size },
      { defaultPageSize: 10, maxPageSize: 50 }
    )
    const cacheKey = `tasks:list:${JSON.stringify({
      page: currentPage,
      page_size: pageSize,
      platform: platform || '',
      status: rawStatus || 1
    })}`
    const cached = cache.get(cacheKey)
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=10')
      return res.json(success(cached))
    }

    let whereClause = 'WHERE status = ? AND remaining_quota > 0'
    const params = [parsePositiveInt(rawStatus || 1, 1)]

    if (platform) {
      whereClause += ' AND platform = ?'
      params.push(normalizePlatform(platform))
    }

    whereClause += ' AND (start_time IS NULL OR start_time <= NOW())'
    whereClause += ' AND (end_time IS NULL OR end_time >= NOW())'
    whereClause += ` AND NOT EXISTS (
      SELECT 1
      FROM submissions s
      WHERE s.task_id = tasks.id
        AND s.review_status = -1
        AND s.expires_at IS NOT NULL
        AND s.expires_at > NOW()
    )`

    const countRow = await db.queryOne(
      `SELECT COUNT(*) AS total
       FROM tasks
       ${whereClause}`,
      params
    )

    const tasks = await db.query(
      `SELECT id, platform, title, description, reward_amount, total_quota, remaining_quota,
              product_name, start_time, accept_start_time, end_time, status, created_at
       FROM tasks
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      params.concat([pageSize, offset])
    )

    const payload = {
      total: Number(countRow?.total || 0),
      page: currentPage,
      page_size: pageSize,
      list: tasks.map((task) => Object.assign(
        {},
        normalizeTaskRecord(Object.assign({}, task, {
          platform: normalizePlatform(task.platform),
          reward_amount: parseFloat(task.reward_amount),
          status: parsePositiveInt(task.status, 1)
        })),
        {
          product_name: task.product_name || ''
        }
      ))
    }

    cache.set(cacheKey, payload, 10000)
    res.setHeader('Cache-Control', 'public, max-age=10')
    res.json(success(payload))
  } catch (err) {
    console.error('Get tasks error:', err)
    res.status(500).json(error(500, '服务器错误'))
  }
}
