const { toDate, formatDateTime, DEFAULT_TIME_ZONE } = require('./timezone')

const TASK_STATUS = {
  PENDING: 'pending',
  ACCEPT_PENDING: 'accept_pending',
  ACCEPT_OPEN: 'accept_open',
  PUBLISHED: 'published',
  ENDED: 'ended',
  PAUSED: 'paused'
}

const SYNC_THROTTLE_MS = 60 * 1000
let lastSyncExpiredTasksAt = 0
const DRAFT_EXPIRE_MINUTES = 60

const getPublicationStatus = (task, now = new Date()) => {
  const status = Number.parseInt(task?.status, 10) || 1
  const start = toDate(task?.start_time)
  const end = toDate(task?.end_time)
  const nowDate = now instanceof Date ? now : new Date(now)

  if (status === 3 || (end && end.getTime() < nowDate.getTime())) {
    return TASK_STATUS.ENDED
  }
  if (status === 2) {
    return TASK_STATUS.PAUSED
  }
  if (start && start.getTime() > nowDate.getTime()) {
    return TASK_STATUS.PENDING
  }
  return TASK_STATUS.PUBLISHED
}

const getAcceptStatus = (task, now = new Date()) => {
  const status = Number.parseInt(task?.status, 10) || 1
  const acceptStart = toDate(task?.accept_start_time) || toDate(task?.start_time)
  const end = toDate(task?.end_time)
  const nowDate = now instanceof Date ? now : new Date(now)

  if (status === 3 || (end && end.getTime() < nowDate.getTime())) {
    return TASK_STATUS.ENDED
  }
  if (status === 2) {
    return TASK_STATUS.PAUSED
  }
  if (acceptStart && acceptStart.getTime() > nowDate.getTime()) {
    return TASK_STATUS.ACCEPT_PENDING
  }
  return TASK_STATUS.ACCEPT_OPEN
}

const getPublicationStatusText = (status) => {
  const map = {
    pending: '待发布',
    published: '已发布',
    ended: '已结束',
    paused: '已暂停'
  }
  return map[status] || '未知'
}

const getAcceptStatusText = (status) => {
  const map = {
    accept_pending: '待接单',
    accept_open: '可接单',
    ended: '已结束',
    paused: '已暂停',
    pending: '待发布'
  }
  return map[status] || '未知'
}

const getPublicationStatusTagType = (status) => {
  const map = {
    pending: 'info',
    published: 'success',
    ended: 'danger',
    paused: 'warning'
  }
  return map[status] || 'info'
}

const getAcceptStatusTagType = (status) => {
  const map = {
    accept_pending: 'warning',
    accept_open: 'success',
    ended: 'danger',
    paused: 'warning',
    pending: 'info'
  }
  return map[status] || 'info'
}

const sweepTaskLifecycle = async (connection) => {
  const now = Date.now()
  if (now - lastSyncExpiredTasksAt < SYNC_THROTTLE_MS) {
    return { expiredCount: 0 }
  }
  lastSyncExpiredTasksAt = now

  const [rows] = await connection.query(
    `SELECT id
     FROM tasks
     WHERE status IN (1, 2)
       AND end_time IS NOT NULL
       AND end_time <= NOW()`
  )

  const expiredIds = rows.map((row) => row.id)
  if (!expiredIds.length) {
    return { expiredCount: 0 }
  }

  await connection.query(
    `UPDATE tasks
     SET status = 3,
         updated_at = NOW()
     WHERE id IN (?)`,
    [expiredIds]
  )

  const [draftRows] = await connection.query(
    `SELECT id
     FROM submissions
     WHERE review_status = -1
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()`
  )

  const expiredDraftIds = draftRows.map((row) => row.id)
  if (expiredDraftIds.length > 0) {
    await connection.query(
      `UPDATE submissions
       SET review_status = -4,
           status = -4,
           release_reason = '任务超时自动释放',
           released_at = NOW(),
           review_note = '任务超时自动释放',
           updated_at = NOW()
       WHERE id IN (?)`,
      [expiredDraftIds]
    )
  }

  return { expiredCount: expiredIds.length, releasedCount: expiredDraftIds.length }
}

const syncExpiredTasks = async (connection) => {
  const result = await sweepTaskLifecycle(connection)
  return result.expiredCount
}

const normalizeTaskRecord = (task) => {
  const publicationStatus = getPublicationStatus(task)
  const acceptStatus = getAcceptStatus(task)

  return {
    ...task,
    timezone: DEFAULT_TIME_ZONE,
    start_time_raw: task?.start_time || null,
    end_time_raw: task?.end_time || null,
    accept_start_time_raw: task?.accept_start_time || null,
    start_time: task?.start_time ? formatDateTime(task.start_time) : '',
    end_time: task?.end_time ? formatDateTime(task.end_time) : '',
    accept_start_time: task?.accept_start_time ? formatDateTime(task.accept_start_time) : '',
    publication_status: publicationStatus,
    publication_status_text: getPublicationStatusText(publicationStatus),
    publication_status_tag_type: getPublicationStatusTagType(publicationStatus),
    accept_status: acceptStatus,
    accept_status_text: getAcceptStatusText(acceptStatus),
    accept_status_tag_type: getAcceptStatusTagType(acceptStatus),
    draft_expires_at: task?.expires_at || null,
    draft_accepted_at: task?.accepted_at || null,
    draft_released_at: task?.released_at || null,
    draft_release_reason: task?.release_reason || ''
  }
}

const getDraftExpireAt = (baseTime = new Date()) => {
  const value = baseTime instanceof Date ? baseTime : new Date(baseTime)
  return new Date(value.getTime() + DRAFT_EXPIRE_MINUTES * 60 * 1000)
}

module.exports = {
  TASK_STATUS,
  getPublicationStatus,
  getAcceptStatus,
  getPublicationStatusText,
  getAcceptStatusText,
  getPublicationStatusTagType,
  getAcceptStatusTagType,
  normalizeTaskRecord,
  syncExpiredTasks,
  sweepTaskLifecycle,
  getDraftExpireAt
}
