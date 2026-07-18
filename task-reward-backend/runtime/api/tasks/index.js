const db = require('../../lib/db')
const { success, error } = require('../../lib/response')
const { normalizePagination, parsePositiveInt } = require('../../lib/pagination')
const { normalizeTaskRecord, syncExpiredTasks } = require('../../lib/task-lifecycle')

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
    return res.status(405).json(error(405, 'Method not allowed'))
  }

  try {
    await db.transaction(async (connection) => {
      await syncExpiredTasks(connection)
    })

    const { page, page_size, platform } = req.query
    const rawStatus = req.query.status
    const { page: currentPage, pageSize, offset } = normalizePagination(
      { page, page_size },
      { defaultPageSize: 10, maxPageSize: 50 }
    )

    let whereClause = 'WHERE status = ? AND remaining_quota > 0'
    const params = [parsePositiveInt(rawStatus ?? 1, 1)]

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

    const countResult = await db.queryOne(
      `SELECT COUNT(*) as total FROM tasks ${whereClause}`,
      params
    )

    const tasks = await db.query(
      `SELECT id, platform, title, description, reward_amount, total_quota, remaining_quota,
              product_name, start_time, accept_start_time, end_time, status, created_at
       FROM tasks
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    res.json(success({
      total: countResult?.total || 0,
      page: currentPage,
      page_size: pageSize,
      list: tasks.map((task) => ({
        ...normalizeTaskRecord({
          ...task,
          platform: normalizePlatform(task.platform),
          reward_amount: parseFloat(task.reward_amount),
          status: parsePositiveInt(task.status, 1)
        }),
        product_name: task.product_name || ''
      }))
    }))
  } catch (err) {
    console.error('Get tasks error:', err)
    res.status(500).json(error(500, '服务器错误'))
  }
}
