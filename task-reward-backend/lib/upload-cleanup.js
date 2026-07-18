const fs = require('fs')
const path = require('path')
const db = require('./db')

const UPLOAD_DIR = path.join(__dirname, '../uploads')
const ORPHAN_RETENTION_HOURS = 12
const DRAFT_RETENTION_HOURS = 12
const REJECTED_RETENTION_DAYS = 3
const APPROVED_RETENTION_DAYS = 90
const PAID_ORDER_FIELD = 'screenshot_paid_order'

const IMAGE_FIELDS = [
  'screenshot_search',
  'screenshot_shop_1',
  'screenshot_shop_2',
  'screenshot_shop_3',
  'screenshot_follow',
  'screenshot_share',
  'screenshot_detail',
  'screenshot_cart',
  'screenshot_paid_order'
]

const extractKey = (value) => {
  if (!value || typeof value !== 'string') return null
  return path.basename(value.split('?')[0])
}

const normalizeDate = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return date
}

const addHours = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000)

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000)

const getSubmissionRetentionDeadline = (submission) => {
  const status = Number(submission?.status ?? submission?.review_status ?? 0)
  const createdAt = normalizeDate(submission?.created_at) || new Date()
  const reviewedAt = normalizeDate(submission?.reviewed_at)
  const releasedAt = normalizeDate(submission?.released_at)
  const expiresAt = normalizeDate(submission?.expires_at)

  if (status === -1) {
    return addHours(expiresAt || createdAt, DRAFT_RETENTION_HOURS)
  }

  if (status === -4) {
    return releasedAt || expiresAt || createdAt
  }

  if (status === 2) {
    return addDays(reviewedAt || createdAt, REJECTED_RETENTION_DAYS)
  }

  if (status === 1) {
    return addDays(reviewedAt || createdAt, APPROVED_RETENTION_DAYS)
  }

  return null
}

async function cleanupUploadDirectory(options = {}) {
  const uploadDir = options.uploadDir || UPLOAD_DIR
  const now = options.now instanceof Date ? options.now : new Date()
  const orphanRetentionHours = Number.isFinite(options.orphanRetentionHours)
    ? options.orphanRetentionHours
    : ORPHAN_RETENTION_HOURS

  if (!fs.existsSync(uploadDir)) {
    return { removed: 0, protected: 0, scanned: 0 }
  }

  const rows = await db.query(
    `SELECT status, created_at, reviewed_at, released_at, expires_at,
            screenshot_search, screenshot_shop_1, screenshot_shop_2, screenshot_shop_3,
            screenshot_follow, screenshot_share, screenshot_detail, screenshot_cart,
            screenshot_paid_order
     FROM submissions`
  )

  const referenced = new Map()
  const protectedFiles = new Set()
  const deletableReferencedFiles = new Set()

  for (const row of rows) {
    const deadline = getSubmissionRetentionDeadline(row)
    const shouldDeleteReferencedFiles = Boolean(deadline && deadline.getTime() <= now.getTime())

    for (const field of IMAGE_FIELDS) {
      const key = extractKey(row[field])
      if (!key) continue

      referenced.set(key, (referenced.get(key) || 0) + 1)

      if (field === PAID_ORDER_FIELD) {
        protectedFiles.add(key)
        continue
      }

      if (shouldDeleteReferencedFiles) {
        deletableReferencedFiles.add(key)
      } else {
        protectedFiles.add(key)
      }
    }
  }

  const orphanCutoff = now.getTime() - orphanRetentionHours * 60 * 60 * 1000
  let removed = 0
  let scanned = 0
  let protectedCount = 0

  for (const fileName of fs.readdirSync(uploadDir)) {
    const fullPath = path.join(uploadDir, fileName)
    scanned += 1

    try {
      const stat = fs.statSync(fullPath)
      if (!stat.isFile()) continue

      const isReferenced = referenced.has(fileName)
      const isProtected = protectedFiles.has(fileName)
      const isDeletableReferenced = deletableReferencedFiles.has(fileName)

      if (isProtected) {
        protectedCount += 1
        continue
      }

      if (isReferenced) {
        if (!isDeletableReferenced) {
          continue
        }
      } else if (stat.mtimeMs >= orphanCutoff) {
        continue
      }

      fs.unlinkSync(fullPath)
      removed += 1
    } catch (error) {
      console.warn('[upload-cleanup] Failed to inspect upload file:', fullPath, error.message)
    }
  }

  return { removed, protected: protectedCount, scanned }
}

module.exports = {
  IMAGE_FIELDS,
  PAID_ORDER_FIELD,
  cleanupUploadDirectory,
  getSubmissionRetentionDeadline,
  extractKey
}
