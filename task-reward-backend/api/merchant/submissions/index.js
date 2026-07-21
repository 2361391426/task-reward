const db = require('../../../lib/db');
const { authenticateMerchant } = require('../../../lib/auth');
const { success, error, ErrorCodes } = require('../../../lib/response');
const { decrypt, maskPhone } = require('../../../lib/crypto');
const { normalizePagination, parsePositiveInt } = require('../../../lib/pagination');

const safeDecrypt = (value) => {
  if (!value) return '';
  try {
    return decrypt(value);
  } catch (err) {
    return value;
  }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = await authenticateMerchant(req, res);
  if (auth.error) {
    return res.status(auth.status).json(error(auth.error.code, auth.error.message));
  }

  const merchantId = auth.merchant.id;

  if (req.method === 'GET') {
    try {
      const { task_id, page, page_size, status, platform, month_key } = req.query;
      const { page: currentPage, pageSize, offset } = normalizePagination(
        { page, page_size },
        { defaultPageSize: 20, maxPageSize: 50 }
      );

      let whereClause = 'WHERE t.merchant_id = ?';
      const params = [merchantId];

      if (task_id) {
        whereClause += ' AND s.task_id = ?';
        params.push(task_id);
      }

      if (status !== undefined) {
        whereClause += ' AND s.review_status = ?';
        params.push(parsePositiveInt(status, 0));
      }

      if (platform) {
        whereClause += ' AND t.platform = ?';
        params.push(platform);
      }

      if (month_key) {
        whereClause += ` AND DATE_FORMAT(s.created_at, '%Y-%m') = ?`;
        params.push(month_key);
      }

      const countResult = await db.queryOne(
        `SELECT COUNT(*) as total
         FROM submissions s
         JOIN tasks t ON s.task_id = t.id
         ${whereClause}`,
        params
      );

      const submissions = await db.query(
        `SELECT s.*, t.title as task_title, t.platform, u.nickname as user_nickname
         FROM submissions s
         JOIN tasks t ON s.task_id = t.id
         JOIN users u ON s.user_id = u.id
         ${whereClause}
         ORDER BY s.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      res.json(success({
        total: countResult.total,
        page: currentPage,
        page_size: pageSize,
        list: submissions.map(sub => {
          let phone = null;
          if (sub.phone_number) {
            const decrypted = safeDecrypt(sub.phone_number);
            phone = maskPhone(decrypted);
          }

          return {
            id: sub.id,
            task_id: sub.task_id,
            task_title: sub.task_title,
            platform: sub.platform,
            user_nickname: sub.user_nickname,
            wechat_id: sub.wechat_id || '',
            phone_number: phone,
            order_number: sub.order_number || '',
            paid_amount: parseFloat(sub.paid_amount || 0),
            screenshot_search: sub.screenshot_search,
            screenshot_shop_1: sub.screenshot_shop_1,
            screenshot_shop_2: sub.screenshot_shop_2,
            screenshot_shop_3: sub.screenshot_shop_3,
            screenshot_follow: sub.screenshot_follow,
            screenshot_share: sub.screenshot_share,
            screenshot_detail: sub.screenshot_detail,
            screenshot_cart: sub.screenshot_cart,
            screenshot_paid_order: sub.screenshot_paid_order,
            address_text: sub.address_text || '',
            status: parsePositiveInt(sub.review_status, 0),
            review_status: parsePositiveInt(sub.review_status, 0),
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
  } else {
    res.status(405).json(error(405, '请求方法不支持'));
  }
};
