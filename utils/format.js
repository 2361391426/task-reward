import dayjs from 'dayjs'

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
  const map = {
    douyin: '抖音',
    xiaohongshu: '小红书',
    taobao: '淘宝',
    jd: '京东'
  }
  return map[platform] || platform || '未知'
}

export const submissionStatusText = (status) => {
  const map = {
    0: '待审核',
    1: '已通过',
    2: '已驳回'
  }
  return map[Number(status)] || '未知'
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
    1: '已通过',
    2: '已驳回'
  }
  return map[Number(status)] || '未知'
}
