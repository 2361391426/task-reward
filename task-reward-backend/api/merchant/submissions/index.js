// 商家获取提交列表和审核
const db = require('../../../lib/db');
const { authenticateMerchant } = require('../../../lib/auth');
const { success, error, ErrorCodes } = require('../../../lib/response');
const { decrypt, maskPhone } = require('../../../lib/crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 认证
  const auth = await authenticateMerchant(req, res);
  if (auth.error) {
    return res.status(auth.status).json(error(auth.error.code, auth.error.message));
  }

  const merchantId = auth.merchant.id;

  // GET - 获取提交列表
  if (req.method === 'GET') {
    try {
      const { task_id, page = 1, page_size = 20, status } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(page_size);

      let whereClause = 'WHERE t.merchant_id = ?';
      const params = [merchantId];

      if (task_id) {
        whereClause += ' AND s.task_id = ?';
        params.push(task_id);
      }

      if (status !== undefined) {
        whereClause += ' AND s.status = ?';
        params.push(parseInt(status));
      }

      // 获取总数
      const countResult = await db.queryOne(
        `SELECT COUNT(*) as total
         FROM submissions s
         JOIN tasks t ON s.task_id = t.id
         ${whereClause}`,
        params
      );

      // 获取列表
      const submissions = await db.query(
        `SELECT s.*, t.title as task_title, u.nickname as user_nickname
         FROM submissions s
         JOIN tasks t ON s.task_id = t.id
         JOIN users u ON s.user_id = u.id
         ${whereClause}
         ORDER BY s.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(page_size), offset]
      );

      res.json(success({
        total: countResult.total,
        page: parseInt(page),
        page_size: parseInt(page_size),
        list: submissions.map(sub => {
          // 解密并脱敏手机号
          let phone = null;
          if (sub.phone_number) {
            const decrypted = decrypt(sub.phone_number);
            phone = maskPhone(decrypted);
          }

          return {
            id: sub.id,
            task_id: sub.task_id,
            task_title: sub.task_title,
            user_nickname: sub.user_nickname,
            phone_number: phone,
            screenshot_search: sub.screenshot_search,
            screenshot_shop_1: sub.screenshot_shop_1,
            screenshot_shop_2: sub.screenshot_shop_2,
            screenshot_shop_3: sub.screenshot_shop_3,
            screenshot_follow: sub.screenshot_follow,
            screenshot_share: sub.screenshot_share,
            screenshot_detail: sub.screenshot_detail,
            screenshot_cart: sub.screenshot_cart,
            status: sub.status,
            reject_reason: sub.reject_reason,
            created_at: sub.created_at,
            reviewed_at: sub.reviewed_at
          };
        })
      }));
    } catch (err) {
      console.error('Get submissions error:', err);
      res.status(500).json(error(500, '服务器错误'));
    }
  }
  // POST - 审核提交（通过路径参数）
  else {
    res.status(405).json(error(405, 'Method not allowed'));
  }
};
