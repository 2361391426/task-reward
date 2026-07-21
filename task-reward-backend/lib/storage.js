const fs = require('fs')
const https = require('https')
const path = require('path')
const crypto = require('crypto')
const { cleanupUploadDirectory } = require('./upload-cleanup')

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
const LOCAL_UPLOAD_RETENTION_DAYS = Number(process.env.LOCAL_UPLOAD_RETENTION_DAYS || 30)
const LOCAL_UPLOAD_CLEANUP_INTERVAL_MS = Number(process.env.LOCAL_UPLOAD_CLEANUP_INTERVAL_MS || 6 * 60 * 60 * 1000)
let lastLocalUploadCleanupAt = 0

const createUploadId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${crypto.randomBytes(16).toString('hex')}`
}

const getLocalUploadDir = () => path.join(__dirname, '../uploads')

const getPublicBaseUrl = () => {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  if (isProduction) {
    throw new Error('生产环境必须配置 PUBLIC_BASE_URL')
  }

  return 'http://127.0.0.1:3001'
}

const ensureLocalUploadDir = () => {
  const uploadDir = getLocalUploadDir()
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
  return uploadDir
}

const cleanupLocalUploads = () => {
  const now = Date.now()
  if (now - lastLocalUploadCleanupAt < LOCAL_UPLOAD_CLEANUP_INTERVAL_MS) {
    return
  }
  lastLocalUploadCleanupAt = now

  const uploadDir = ensureLocalUploadDir()

  cleanupUploadDirectory({
    uploadDir,
    orphanRetentionHours: Number.isFinite(LOCAL_UPLOAD_RETENTION_DAYS) && LOCAL_UPLOAD_RETENTION_DAYS > 0
      ? LOCAL_UPLOAD_RETENTION_DAYS * 24
      : 30 * 24,
    now: new Date()
  }).catch((err) => {
    console.warn('[storage] 清理本地上传目录失败:', err.message)
  })
}

const hmac = (key, value) => crypto.createHmac('sha256', key).update(value).digest()
const sha256Hex = (value) => crypto.createHash('sha256').update(value).digest('hex')

const encodePath = (value) => String(value || '')
  .split('/')
  .map(segment => encodeURIComponent(segment))
  .join('/')

const getR2Config = () => {
  const endpoint = process.env.R2_ENDPOINT
  const bucket = process.env.R2_BUCKET
  const publicUrl = process.env.R2_PUBLIC_URL
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!endpoint || !bucket || !publicUrl || !accessKeyId || !secretAccessKey) {
    if (isProduction) {
      throw new Error('生产环境必须完整配置 R2 存储')
    }
    return null
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ''),
    accessKeyId,
    secretAccessKey
  }
}

const buildR2Path = (endpointUrl, bucket, key) => {
  const basePath = endpointUrl.pathname.replace(/\/+$/, '')
  const normalizedKey = encodePath(key)
  const pathHasBucket = basePath === `/${bucket}` || basePath.endsWith(`/${bucket}`)
  if (pathHasBucket) {
    return `${basePath}/${normalizedKey}`
  }
  return `${basePath}/${encodeURIComponent(bucket)}/${normalizedKey}`
}

const putR2Object = async ({ fileBuffer, key, mimetype, config }) => {
  const endpointUrl = new URL(config.endpoint)
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const region = 'auto'
  const service = 's3'
  const payloadHash = sha256Hex(fileBuffer)
  const requestPath = buildR2Path(endpointUrl, config.bucket, key)

  const canonicalHeaders = [
    `content-type:${mimetype}`,
    `host:${endpointUrl.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join('\n') + '\n'
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = [
    'PUT',
    requestPath,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n')

  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, region)
  const serviceKey = hmac(regionKey, service)
  const signingKey = hmac(serviceKey, 'aws4_request')
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  await new Promise((resolve, reject) => {
    const req = https.request({
      method: 'PUT',
      hostname: endpointUrl.hostname,
      port: endpointUrl.port || 443,
      path: requestPath,
      headers: {
        Authorization: authorization,
        'Content-Type': mimetype,
        'Content-Length': fileBuffer.length,
        Host: endpointUrl.host,
        'X-Amz-Content-Sha256': payloadHash,
        'X-Amz-Date': amzDate
      },
      timeout: Number(process.env.R2_UPLOAD_TIMEOUT_MS || 15000)
    }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
          return
        }
        const body = Buffer.concat(chunks).toString('utf8')
        reject(new Error(`R2 上传失败：HTTP ${res.statusCode} ${body.slice(0, 200)}`))
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error('R2 上传超时'))
    })
    req.on('error', reject)
    req.end(fileBuffer)
  })
}

const normalizePurpose = (purpose) => {
  const value = String(purpose || 'submission').trim().toLowerCase()
  if (['avatar', 'feedback', 'merchant', 'submission'].includes(value)) {
    return value
  }
  return 'submission'
}

async function uploadFile(fileBuffer, originalFilename, mimetype, options = {}) {
  const ext = path.extname(originalFilename || '') || '.jpg'
  const filename = `${createUploadId()}${ext}`
  const date = new Date().toISOString().split('T')[0]
  const purpose = normalizePurpose(options.purpose)
  const key = `uploads/${purpose}/${date}/${filename}`
  const r2Config = getR2Config()

  if (r2Config) {
    await putR2Object({ fileBuffer, key, mimetype, config: r2Config })
    return `${r2Config.publicUrl}/${key}`
  }

  if (isProduction) {
    throw new Error('生产环境禁止使用本地上传兜底')
  }

  const uploadDir = ensureLocalUploadDir()
  cleanupLocalUploads()
  const localPath = path.join(uploadDir, filename)
  fs.writeFileSync(localPath, fileBuffer)
  return `${getPublicBaseUrl()}/uploads/${filename}`
}

module.exports = {
  uploadFile
}
