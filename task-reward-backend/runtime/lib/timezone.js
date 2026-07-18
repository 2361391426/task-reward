const DEFAULT_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Shanghai'

const pad = (num) => String(num).padStart(2, '0')

const toDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return value

  const text = String(value).trim()
  if (!text) return null

  if (/[zZ]$/.test(text) || /[+-]\d{2}:\d{2}$/.test(text)) {
    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const normalized = text.replace('T', ' ').slice(0, 19)
  const [datePart, timePart = '00:00:00'] = normalized.split(' ')
  const [year, month, day] = datePart.split('-').map((item) => parseInt(item, 10))
  const [hour = 0, minute = 0, second = 0] = timePart.split(':').map((item) => parseInt(item, 10))

  if ([year, month, day].some((item) => Number.isNaN(item))) {
    return null
  }

  const utc = Date.UTC(year, month - 1, day, hour, minute, second)
  const offsetMinutes = DEFAULT_TIME_ZONE === 'Asia/Shanghai' ? 8 * 60 : 0
  return new Date(utc - offsetMinutes * 60 * 1000)
}

const formatDateTime = (value, timeZone = DEFAULT_TIME_ZONE) => {
  const date = toDate(value)
  if (!date) return ''

  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date)

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`
}

const compareDate = (a, b) => {
  const da = toDate(a)
  const db = toDate(b)
  if (!da && !db) return 0
  if (!da) return -1
  if (!db) return 1
  return da.getTime() - db.getTime()
}

module.exports = {
  DEFAULT_TIME_ZONE,
  toDate,
  formatDateTime,
  compareDate
}
