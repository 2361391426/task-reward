const STARTED_TASK_DRAFT_KEY = 'task-reward:started-task-drafts'

const safeParse = (value, fallback) => {
  if (!value) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

export const readStartedTaskDrafts = () => {
  try {
    const raw = uni.getStorageSync(STARTED_TASK_DRAFT_KEY)
    const parsed = safeParse(raw, [])
    if (Array.isArray(parsed)) {
      return parsed
    }
    if (parsed && typeof parsed === 'object') {
      return Object.values(parsed).filter(Boolean)
    }
    return []
  } catch (error) {
    return []
  }
}

export const saveStartedTaskDraft = (task = {}) => {
  if (!task || !task.task_id && !task.id) {
    return null
  }

  const taskId = String(task.task_id || task.id)
  const existing = readStartedTaskDrafts().filter(item => String(item.task_id) !== taskId)
  const now = new Date().toISOString()
  const draft = {
    id: `draft-${taskId}`,
    task_id: taskId,
    task_title: task.task_title || task.title || '体验项目',
    platform: task.platform || '',
    reward_amount: Number(task.reward_amount || 0),
    total_quota: Number(task.total_quota || 0),
    used_quota: Number(task.used_quota || 0),
    remaining_quota: Number(task.remaining_quota ?? Math.max(Number(task.total_quota || 0) - Number(task.used_quota || 0), 0)),
    start_time: task.accept_start_time || task.start_time || '',
    end_time: task.end_time || '',
    created_at: task.created_at || now,
    submit_time: now,
    review_status: -1,
    status: -1,
    local_draft: true,
    draft_status: 'in_progress'
  }

  existing.unshift(draft)
  uni.setStorageSync(STARTED_TASK_DRAFT_KEY, JSON.stringify(existing))
  return draft
}

export const clearStartedTaskDraft = (taskId) => {
  if (!taskId && taskId !== 0) return
  const normalizedId = String(taskId)
  const remaining = readStartedTaskDrafts().filter(item => String(item.task_id) !== normalizedId)
  uni.setStorageSync(STARTED_TASK_DRAFT_KEY, JSON.stringify(remaining))
}

export const mergeStartedTaskDrafts = (list = []) => {
  const source = Array.isArray(list) ? [...list] : []
  const drafts = readStartedTaskDrafts()
  const existingIds = new Set(source.map(item => String(item.task_id || item.id)).filter(Boolean))

  drafts.forEach((draft) => {
    const taskId = String(draft.task_id)
    if (!taskId || existingIds.has(taskId)) {
      return
    }
    source.unshift({
      ...draft,
      id: draft.id || `draft-${taskId}`,
      task_id: taskId,
      local_draft: true,
      review_status: -1,
      status: -1
    })
  })

  return source
}

export const hasStartedTaskDraft = (taskId) => {
  if (!taskId && taskId !== 0) return false
  const normalizedId = String(taskId)
  return readStartedTaskDrafts().some(item => String(item.task_id) === normalizedId)
}
