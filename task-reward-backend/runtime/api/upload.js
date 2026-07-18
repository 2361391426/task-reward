const Busboy = require('busboy');
const { uploadFile } = require('../lib/storage');
const { authenticateUser, authenticateMerchant } = require('../lib/auth');
const { success, error } = require('../lib/response');

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const detectImageType = (buffer) => {
  if (!buffer || buffer.length < 12) {
    return null;
  }

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
    return 'image/png';
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9) {
    return 'image/jpeg';
  }

  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x39 || buffer[4] === 0x37) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json(error(405, '不支持的请求方法'));
  }

  try {
    let auth = await authenticateUser(req);
    if (auth.error) {
      auth = await authenticateMerchant(req);
    }

    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_FILE_SIZE
      }
    });

    let fileBuffer = null;
    let filename = '';
    let mimetype = '';
    let fileTooLarge = false;
    let fileReceived = false;

    busboy.on('file', (fieldname, file, info) => {
      fileReceived = true;
      filename = info.filename || '';
      mimetype = info.mimeType || '';

      const chunks = [];
      file.on('limit', () => {
        fileTooLarge = true;
        file.resume();
      });

      file.on('data', (chunk) => {
        chunks.push(chunk);
      });

      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('finish', async () => {
      try {
        if (!fileReceived || !fileBuffer) {
        return res.status(400).json(error(1001, '未找到文件'));
        }

        if (fileTooLarge || fileBuffer.length > MAX_FILE_SIZE) {
          return res.status(400).json(error(1001, '文件大小不能超过 5MB'));
        }

        const detectedType = detectImageType(fileBuffer);
        if (!detectedType) {
          return res.status(400).json(error(1001, '图片文件无效'));
        }

        if (mimetype && !mimetype.startsWith('image/')) {
          return res.status(400).json(error(1001, '仅支持图片文件'));
        }

        const url = await uploadFile(fileBuffer, filename, detectedType);
        return res.json(success({ url }));
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        return res.status(500).json(error(500, '上传失败'));
      }
    });

    busboy.on('error', (err) => {
      console.error('Busboy error:', err);
      return res.status(500).json(error(500, '文件解析失败'));
    });

    req.pipe(busboy);
  } catch (err) {
    console.error('Upload handler error:', err);
    return res.status(500).json(error(500, '服务器错误'));
  }
};
