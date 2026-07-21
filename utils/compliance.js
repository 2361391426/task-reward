const SAFE_MODE_VALUE = String(import.meta.env.VITE_REVIEW_SAFE_MODE ?? 'true').toLowerCase()

export const REVIEW_SAFE_MODE = !['false', '0', 'off', 'no'].includes(SAFE_MODE_VALUE)

const HIGH_RISK_KEYWORDS = [
  '关注',
  '评论',
  '分享',
  '刷单',
  '刷量'
]

export const isHighRiskPlatform = () => false

export const isHighRiskTask = (task = {}) => {
  if (!REVIEW_SAFE_MODE) return false

  const text = [
    task.title,
    task.description,
    task.search_keyword,
    task.shop_name,
    task.product_name
  ].filter(Boolean).join(' ')

  return HIGH_RISK_KEYWORDS.some(keyword => text.includes(keyword))
}

export const safeMoneyLabel = '体验积分'

export const safeTaskName = '体验项目'

export const safeJoinText = '参与体验'

export const safeSettlementText = '积分记录'
