const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

let s3Client = null;
let PutObjectCommand = null;
const LOCAL_UPLOAD_RETENTION_DAYS = Number(process.env.LOCAL_UPLOAD_RETENTION_DAYS || 30);

const getLocalUploadDir = () => path.join(__dirname, '../uploads');
const getPublicBaseUrl = () => {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3001';
};

const ensureLocalUploadDir = () => {
  const uploadDir = getLocalUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

const cleanupLocalUploads = () => {
  const retentionDays = Number.isFinite(LOCAL_UPLOAD_RETENTION_DAYS) && LOCAL_UPLOAD_RETENTION_DAYS > 0
    ? LOCAL_UPLOAD_RETENTION_DAYS
    : 30;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const uploadDir = ensureLocalUploadDir();

  for (const entry of fs.readdirSync(uploadDir)) {
    const fullPath = path.join(uploadDir, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      console.warn('[storage] Failed to clean local upload:', fullPath, err.message);
    }
  }
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

  const uploadDir = ensureLocalUploadDir();
  cleanupLocalUploads();
  const localPath = path.join(uploadDir, filename);
  fs.writeFileSync(localPath, fileBuffer);
  return `${getPublicBaseUrl()}/uploads/${filename}`;
}

module.exports = {
  uploadFile
};
