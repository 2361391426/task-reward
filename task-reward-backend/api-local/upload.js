const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const { queryOne } = require('../lib/db-json')
const { success, error } = require('../lib/response')

const MAX_FILE_SIZE = 5 * 1024 * 1024

const detectImageType = (buffer) => {
  if (!buffer || buffer.length < 12) return null

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9) {
    return 'image/jpeg'
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x39 || buffer[4] === 0x37) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif'
  }

  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }

  return null
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const mimetype = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype)

    if (mimetype) {
      return cb(null, true)
    }
    cb(new Error('仅支持图片文件'))
  }
})

const getToken = (req) => req.headers.authorization?.replace('Bearer ', '')

const verifyToken = (token) => {
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret')
  } catch (err) {
    return null
  }
}

const requireUser = (req) => {
  const decoded = verifyToken(getToken(req))
  if (!decoded) return null

  const userId = decoded.userId || decoded.user_id
  if (!userId) return null

  const user = queryOne('users', { id: userId })
  if (!user) return null

  return { user, decoded }
}

const requireMerchant = (req) => {
  const decoded = verifyToken(getToken(req))
  if (!decoded) return null

  const merchantId = decoded.merchantId || decoded.merchant_id || decoded.user_id
  if (!merchantId) return null

  const merchant = queryOne('merchants', { id: merchantId })
  if (!merchant) return null

  return { merchant, decoded }
}

router.post('/', (req, res, next) => {
  const auth = requireUser(req) || requireMerchant(req)
  if (!auth) {
    return res.status(401).json(error('未登录或账号无效'))
  }

  req.user = auth.user || auth.merchant
  return upload.single('file')(req, res, next)
}, (req, res) => {
  try {
    if (!req.file) {
      return res.json(error('请选择文件'))
    }

    const filePath = path.join(__dirname, '../uploads', req.file.filename)
    const fileBuffer = fs.readFileSync(filePath)
    const detectedType = detectImageType(fileBuffer)

    if (!detectedType) {
      fs.unlinkSync(filePath)
      return res.json(error('图片文件无效'))
    }

    if (req.file.mimetype && !req.file.mimetype.startsWith('image/')) {
      fs.unlinkSync(filePath)
      return res.json(error('仅支持图片文件'))
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
    res.json(success({ url: fileUrl }))
  } catch (err) {
    console.error('上传失败:', err)
    res.json(error('上传失败'))
  }
})

module.exports = router
