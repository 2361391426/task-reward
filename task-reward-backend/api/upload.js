// 文件上传
const Busboy = require('busboy');
const { uploadFile } = require('../../lib/storage');
const { authenticateUser } = require('../../lib/auth');
const { success, error } = require('../../lib/response');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json(error(405, 'Method not allowed'));
  }

  try {
    // 认证
    const auth = await authenticateUser(req, res);
    if (auth.error) {
      return res.status(auth.status).json(error(auth.error.code, auth.error.message));
    }

    // 解析multipart/form-data
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let filename = null;
    let mimetype = null;

    busboy.on('file', (fieldname, file, info) => {
      const { filename: fname, mimeType } = info;
      filename = fname;
      mimetype = mimeType;

      const chunks = [];
      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('finish', async () => {
      try {
        if (!fileBuffer) {
          return res.status(400).json(error(1001, '未找到文件'));
        }

        // 验证文件类型
        if (!mimetype.startsWith('image/')) {
          return res.status(400).json(error(1001, '只支持图片文件'));
        }

        // 验证文件大小（最大5MB）
        if (fileBuffer.length > 5 * 1024 * 1024) {
          return res.status(400).json(error(1001, '文件大小不能超过5MB'));
        }

        // 上传到R2
        const url = await uploadFile(fileBuffer, filename, mimetype);

        res.json(success({ url }));
      } catch (uploadError) {
        console.error('Upload error:', uploadError);
        res.status(500).json(error(500, '上传失败'));
      }
    });

    busboy.on('error', (err) => {
      console.error('Busboy error:', err);
      res.status(500).json(error(500, '文件解析失败'));
    });

    req.pipe(busboy);
  } catch (err) {
    console.error('Upload handler error:', err);
    res.status(500).json(error(500, '服务器错误'));
  }
};
