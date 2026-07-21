import dayjs from 'dayjs'
import { REVIEW_SAFE_MODE } from './compliance.js'

export const formatTime = (time) => {
  if (!time) return ''
  const date = dayjs(time)
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : String(time)
}

export const formatDate = (time) => {
  if (!time) return ''
  const date = dayjs(time)
  return date.isValid() ? date.format('YYYY-MM-DD') : String(time)
}

export const platformText = (platform) => {
  const safeMap = {
    douyin: '内容平台',
    xiaohongshu: '内容社区',
    taobao: '电商平台',
    jd: '电商平台'
  }
  const normalMap = safeMap
  const map = REVIEW_SAFE_MODE ? safeMap : normalMap
  return map[platform] || platform || '未知'
}

export const submissionStatusText = (status) => {
  const map = {
    '-1': '进行中',
    0: '待审核',
    1: '已通过',
    2: '已驳回'
  }
  return map[String(Number(status))] || map[Number(status)] || '未知'
}

export const taskStatusText = (status) => {
  const map = {
    1: '进行中',
    2: '已暂停',
    3: '已结束'
  }
  return map[Number(status)] || '未知'
}

export const withdrawalStatusText = (status) => {
  const map = {
    0: '待处理',
    1: '已确认',
    2: '已驳回'
  }
  return map[Number(status)] || '未知'
}
