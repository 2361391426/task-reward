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

export const taskStatusText = (status) => {
  const map = {
    1: '进行中',
    2: '已暂停',
    3: '已结束'
  }
  return map[Number(status)] || '未知'
}

export const taskStatusTagType = (status) => {
  const map = {
    1: 'success',
    2: 'warning',
    3: 'info'
  }
  return map[Number(status)] || 'info'
}

export const publicationStatusText = (status) => {
  const map = {
    pending: '待发布',
    published: '已发布',
    ended: '已结束',
    paused: '已暂停'
  }
  return map[status] || '未知'
}

export const publicationStatusTagType = (status) => {
  const map = {
    pending: 'info',
    published: 'success',
    ended: 'danger',
    paused: 'warning'
  }
  return map[status] || 'info'
}

export const submissionStatusText = (status) => {
  const map = {
    0: '待审',
    1: '通过',
    2: '驳回'
  }
  return map[Number(status)] || '未知'
}

export const submissionStatusTagType = (status) => {
  const map = {
    0: 'warning',
    1: 'success',
    2: 'danger'
  }
  return map[Number(status)] || 'info'
}

export const withdrawalStatusText = (status) => {
  const map = {
    0: '待处理',
    1: '已通过',
    2: '已驳回'
  }
  return map[Number(status)] || '未知'
}

export const withdrawalStatusTagType = (status) => {
  const map = {
    0: 'warning',
    1: 'success',
    2: 'danger'
  }
  return map[Number(status)] || 'info'
}

export const withdrawTypeText = (type) => {
  const map = {
    1: '微信',
    2: '支付宝'
  }
  return map[Number(type)] || '未知'
}

export const paymentMethodText = (value) => {
  const map = {
    1: '微信支付',
    2: '支付宝',
    3: '银行卡'
  }
  return map[Number(value)] || '未知'
}

export const rechargeStatusText = (status) => {
  return Number(status) === 1 ? '已入账' : '处理中'
}

export const rechargeStatusTagType = (status) => {
  return Number(status) === 1 ? 'success' : 'warning'
}
