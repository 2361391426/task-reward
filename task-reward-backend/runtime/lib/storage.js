const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { cleanupUploadDirectory } = require('./upload-cleanup');

let s3Client = null;
let PutObjectCommand = null;
const isProduction = (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production');
const LOCAL_UPLOAD_RETENTION_DAYS = Number(process.env.LOCAL_UPLOAD_RETENTION_DAYS || 30);
const LOCAL_UPLOAD_CLEANUP_INTERVAL_MS = Number(process.env.LOCAL_UPLOAD_CLEANUP_INTERVAL_MS || 6 * 60 * 60 * 1000);
let lastLocalUploadCleanupAt = 0;

const getLocalUploadDir = () => path.join(__dirname, '../uploads');
const getPublicBaseUrl = () => {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (isProduction) {
    throw new Error('PUBLIC_BASE_URL must be set in production');
  }

  return 'http://127.0.0.1:3001';
};

const ensureLocalUploadDir = () => {
  const uploadDir = getLocalUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

const cleanupLocalUploads = () => {
  const now = Date.now();
  if (now - lastLocalUploadCleanupAt < LOCAL_UPLOAD_CLEANUP_INTERVAL_MS) {
    return;
  }
  lastLocalUploadCleanupAt = now;

  const uploadDir = ensureLocalUploadDir();

  cleanupUploadDirectory({
    uploadDir,
    orphanRetentionHours: Number.isFinite(LOCAL_UPLOAD_RETENTION_DAYS) && LOCAL_UPLOAD_RETENTION_DAYS > 0
      ? LOCAL_UPLOAD_RETENTION_DAYS * 24
      : 30 * 24,
    now: new Date()
  }).catch((err) => {
    console.warn('[storage] Failed to clean local uploads:', err.message);
  });
};

const getR2Client = () => {
  if (s3Client) {
    return { s3Client, PutObjectCommand };
  }

  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !publicUrl || !accessKeyId || !secretAccessKey) {
    if (isProduction) {
      throw new Error('R2 storage configuration is required in production');
    }
    return null;
  }

  const sdk = require('@aws-sdk/client-s3');
  s3Client = new sdk.S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
  PutObjectCommand = sdk.PutObjectCommand;

  return { s3Client, PutObjectCommand };
};

async function uploadFile(fileBuffer, originalFilename, mimetype) {
  const ext = path.extname(originalFilename || '');
  const filename = `${randomUUID()}${ext}`;
  const date = new Date().toISOString().split('T')[0];
  const key = `uploads/${date}/${filename}`;

  const r2 = getR2Client();
  if (r2) {
    const command = new r2.PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimetype
    });

    await r2.s3Client.send(command);
    return `${process.env.R2_PUBLIC_URL}/${key}`;
  }

  if (isProduction) {
    throw new Error('Local upload fallback is disabled in production');
  }

  const uploadDir = ensureLocalUploadDir();
  cleanupLocalUploads();
  const localPath = path.join(uploadDir, filename);
  fs.writeFileSync(localPath, fileBuffer);
  return `${getPublicBaseUrl()}/uploads/${filename}`;
}

module.exports = {
  uploadFile
};
