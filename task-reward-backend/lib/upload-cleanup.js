const fs = require('fs')
const path = require('path')
const { S3Client, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3')
const db = require('./db')

const UPLOAD_DIR = path.join(__dirname, '../uploads')
const ORPHAN_RETENTION_HOURS = 12
const DRAFT_RETENTION_HOURS = 12
const REJECTED_RETENTION_DAYS = 3
const APPROVED_RETENTION_DAYS = 90
const PAID_ORDER_FIELD = 'screenshot_paid_order'
const R2_UPLOAD_PREFIX = 'uploads/'

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

const getR2Config = () => {
  const endpoint = process.env.R2_ENDPOINT
  const bucket = process.env.R2_BUCKET
  const publicUrl = process.env.R2_PUBLIC_URL
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!endpoint || !bucket || !publicUrl || !accessKeyId || !secretAccessKey) {
    return null
  }

  const endpointUrl = new URL(endpoint)
  return {
    endpoint: endpointUrl.origin,
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ''),
    accessKeyId,
    secretAccessKey
  }
}

const getR2Client = (config) => new S3Client({
  region: 'auto',
  endpoint: config.endpoint,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey
  },
  forcePathStyle: true
})

const extractFileName = (value) => {
  if (!value || typeof value !== 'string') return null
  return path.basename(value.split('?')[0])
}

const extractObjectKey = (value) => {
  if (!value || typeof value !== 'string') return null
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '')

  try {
    const url = new URL(value)
    return decodeURIComponent(url.pathname.replace(/^\/+/, ''))
  } catch {
    return null
  }
}

const buildReferenceSets = (rows, now) => {
  const local = {
    referenced: new Map(),
    protected: new Set(),
    deletableReferenced: new Set()
  }
  const object = {
    referenced: new Map(),
    protected: new Set(),
    deletableReferenced: new Set()
  }

  for (const row of rows) {
    const deadline = getSubmissionRetentionDeadline(row)
    const shouldDeleteReferencedFiles = Boolean(deadline && deadline.getTime() <= now.getTime())

    for (const field of IMAGE_FIELDS) {
      const fileName = extractFileName(row[field])
      const objectKey = extractObjectKey(row[field])
      if (!fileName && !objectKey) continue

      if (fileName) {
        local.referenced.set(fileName, (local.referenced.get(fileName) || 0) + 1)
      }
      if (objectKey) {
        object.referenced.set(objectKey, (object.referenced.get(objectKey) || 0) + 1)
      }

      if (field === PAID_ORDER_FIELD) {
        if (fileName) local.protected.add(fileName)
        if (objectKey) object.protected.add(objectKey)
        continue
      }

      if (shouldDeleteReferencedFiles) {
        if (fileName) local.deletableReferenced.add(fileName)
        if (objectKey) object.deletableReferenced.add(objectKey)
      } else {
        if (fileName) local.protected.add(fileName)
        if (objectKey) object.protected.add(objectKey)
      }
    }
  }

  return { local, object }
}

const getSubmissionRows = () => db.query(
  `SELECT status, review_status, created_at, reviewed_at, released_at, expires_at,
          screenshot_search, screenshot_shop_1, screenshot_shop_2, screenshot_shop_3,
          screenshot_follow, screenshot_share, screenshot_detail, screenshot_cart,
          screenshot_paid_order
   FROM submissions`
)

async function cleanupUploadDirectory(options = {}) {
  const uploadDir = options.uploadDir || UPLOAD_DIR
  const now = options.now instanceof Date ? options.now : new Date()
  const orphanRetentionHours = Number.isFinite(options.orphanRetentionHours)
    ? options.orphanRetentionHours
    : ORPHAN_RETENTION_HOURS

  if (!fs.existsSync(uploadDir)) {
    return { removed: 0, protected: 0, scanned: 0 }
  }

  const rows = await getSubmissionRows()
  const { local } = buildReferenceSets(rows, now)
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

      const isReferenced = local.referenced.has(fileName)
      const isProtected = local.protected.has(fileName)
      const isDeletableReferenced = local.deletableReferenced.has(fileName)

      if (isProtected) {
        protectedCount += 1
        continue
      }

      if (isReferenced) {
        if (!isDeletableReferenced) continue
      } else if (stat.mtimeMs >= orphanCutoff) {
        continue
      }

      fs.unlinkSync(fullPath)
      removed += 1
    } catch (error) {
      console.warn('[upload-cleanup] 本地文件检查失败:', fullPath, error.message)
    }
  }

  return { removed, protected: protectedCount, scanned }
}

async function cleanupR2Objects(options = {}) {
  const config = getR2Config()
  if (!config) {
    return { removed: 0, protected: 0, scanned: 0, skipped: true }
  }

  const now = options.now instanceof Date ? options.now : new Date()
  const orphanRetentionHours = Number.isFinite(options.orphanRetentionHours)
    ? options.orphanRetentionHours
    : ORPHAN_RETENTION_HOURS
  const orphanCutoff = now.getTime() - orphanRetentionHours * 60 * 60 * 1000
  const rows = await getSubmissionRows()
  const { object } = buildReferenceSets(rows, now)
  const client = getR2Client(config)

  let continuationToken
  let removed = 0
  let protectedCount = 0
  let scanned = 0

  do {
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: R2_UPLOAD_PREFIX,
      ContinuationToken: continuationToken
    }))

    for (const item of listed.Contents || []) {
      const key = item.Key
      if (!key) continue
      scanned += 1

      const isReferenced = object.referenced.has(key)
      const isProtected = object.protected.has(key)
      const isDeletableReferenced = object.deletableReferenced.has(key)
      const modifiedAt = normalizeDate(item.LastModified)

      if (isProtected) {
        protectedCount += 1
        continue
      }

      if (isReferenced) {
        if (!isDeletableReferenced) continue
      } else if (modifiedAt && modifiedAt.getTime() >= orphanCutoff) {
        continue
      }

      await client.send(new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key
      }))
      removed += 1
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : null
  } while (continuationToken)

  return { removed, protected: protectedCount, scanned, skipped: false }
}

async function cleanupUploads(options = {}) {
  const local = await cleanupUploadDirectory(options)
  const r2 = await cleanupR2Objects(options)
  return { local, r2 }
}

module.exports = {
  IMAGE_FIELDS,
  PAID_ORDER_FIELD,
  cleanupUploadDirectory,
  cleanupR2Objects,
  cleanupUploads,
  getSubmissionRetentionDeadline,
  extractKey: extractFileName,
  extractFileName,
  extractObjectKey
}
