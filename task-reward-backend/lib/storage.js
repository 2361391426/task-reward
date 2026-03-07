// 文件上传到Cloudflare R2
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// 初始化S3客户端（R2兼容S3 API）
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// 上传文件
async function uploadFile(fileBuffer, originalFilename, mimetype) {
  try {
    const ext = path.extname(originalFilename);
    const filename = `${uuidv4()}${ext}`;
    const date = new Date().toISOString().split('T')[0];
    const key = `uploads/${date}/${filename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimetype
    });

    await s3Client.send(command);

    // 返回公开访问URL
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    return publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('文件上传失败');
  }
}

module.exports = {
  uploadFile
};
