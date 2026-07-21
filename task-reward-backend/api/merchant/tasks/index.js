const db = require('../../../lib/db');
const { authenticateMerchant, merchantRoleAllowed } = require('../../../lib/auth');
const { success, error, ErrorCodes } = require('../../../lib/response');
const { normalizeTaskRecord, syncExpiredTasks } = require('../../../lib/task-lifecycle');

const normalizePlatform = (value) => {
  const platforms = ['douyin', 'xiaohongshu', 'taobao', 'jd'];
  return platforms.includes(value) ? value : 'taobao';
};

const { normalizePagination, parsePositiveInt } = require('../../../lib/pagination');

const getOperatorId = (merchant) => merchant?.staff_id || merchant?.id;

const normalizeStatus = (value) => {
  const parsed = parseInt(value, 10);
  return [1, 2, 3].includes(parsed) ? parsed : null;
};

const calculateCloseRefund = (task) => {
  const remainingQuota = Math.max(parsePositiveInt(task.remaining_quota, 0), 0);
  const rewardAmount = parseFloat(task.reward_amount || 0);
  return Math.max(remainingQuota * rewardAmount, 0);
};

const parseRequirements = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const writeAuditLog = async (connection, payload) => {
  await connection.query(
    `INSERT INTO audit_logs
     (operator_type, operator_id, action, target_type, target_id, summary, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      payload.operator_type,
      payload.operator_id,
      payload.action,
      payload.target_type,
      payload.target_id,
      payload.summary || null,
      payload.detail ? JSON.stringify(payload.detail) : null
    ]
  );
};

const createTaskWithNeon = async ({
  merchantId,
  operatorId,
  normalizedPlatform,
  title,
  description,
  parsedReward,
  parsedQuota,
  search_keyword,
  shop_name,
  product_name,
  product_link,
  requirements,
  start_time,
  accept_start_time,
  end_time,
  totalCost
}) => {
  const pool = db.getPool();
  const detail = {
    platform: normalizedPlatform,
    reward_amount: parsedReward,
    total_quota: parsedQuota
  };
  const normalizedRequirements = parseRequirements(requirements);
  const result = await pool.query(
    `WITH updated_merchant AS (
       UPDATE merchants
       SET balance = balance - $2, updated_at = NOW()
       WHERE id = $1 AND balance >= $2
       RETURNING id
     ),
     inserted_task AS (
       INSERT INTO tasks
       (merchant_id, platform, title, description, reward_amount, total_quota, remaining_quota,
        search_keyword, shop_name, product_name, product_link, requirements, start_time, accept_start_time, end_time,
        status, created_at, updated_at)
       SELECT $1, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, 1, NOW(), NOW()
       FROM updated_merchant
       RETURNING id
     ),
     inserted_audit AS (
       INSERT INTO audit_logs
       (operator_type, operator_id, action, target_type, target_id, summary, detail, created_at)
       SELECT 'merchant', $16, 'task_create', 'task', id, $17, $18::jsonb, NOW()
       FROM inserted_task
       RETURNING target_id
     )
     SELECT id AS task_id FROM inserted_task`,
    [
      merchantId,
      totalCost,
      normalizedPlatform,
      title,
      description || null,
      parsedReward,
      parsedQuota,
      search_keyword || null,
      shop_name || null,
      product_name || null,
      product_link || null,
      normalizedRequirements,
      start_time || null,
      accept_start_time || null,
      end_time || null,
      operatorId,
      `创建项目：${title}`,
      JSON.stringify(detail)
    ]
  );

  const task = result.rows[0];
  if (task) {
    return { task_id: task.task_id };
  }

  const merchant = await db.queryOne(
    'SELECT id, balance FROM merchants WHERE id = ? LIMIT 1',
    [merchantId]
  );
  if (!merchant) {
    throw new Error('merchant_not_found');
  }
  throw new Error('insufficient_balance');
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = await authenticateMerchant(req, res);
  if (auth.error) {
    return res.status(auth.status).json(error(auth.error.code, auth.error.message));
  }

  const merchantId = auth.merchant.id;
  const operatorId = getOperatorId(auth.merchant);
  if (!merchantRoleAllowed(auth.merchant, ['owner', 'operator', 'reviewer'])) {
    return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '没有操作权限'));
  }

  if (req.method === 'GET') {
    try {
      await db.transaction(async (connection) => {
        await syncExpiredTasks(connection);
      });

      const { page, page_size, status, platform } = req.query;
      const { page: currentPage, pageSize, offset } = normalizePagination(
        { page, page_size },
        { defaultPageSize: 10, maxPageSize: 50 }
      );

      let whereClause = 'WHERE t.merchant_id = ?';
      const params = [merchantId];

      if (status !== undefined && status !== null && status !== '') {
        whereClause += ' AND t.status = ?';
        params.push(parsePositiveInt(status, 1));
      }

      if (platform) {
        whereClause += ' AND t.platform = ?';
        params.push(normalizePlatform(platform));
      }

      const countResult = await db.queryOne(
        `SELECT COUNT(*) AS total FROM tasks t ${whereClause}`,
        params
      );

      const tasks = await db.query(
        `SELECT t.id, t.platform, t.title, t.description, t.reward_amount, t.total_quota, t.remaining_quota,
                t.search_keyword, t.shop_name, t.product_name, t.product_link, t.requirements,
                t.start_time, t.accept_start_time, t.end_time, t.status, t.created_at,
                COUNT(s.id) AS submission_count,
                COALESCE(SUM(CASE WHEN s.review_status = 0 THEN 1 ELSE 0 END), 0) AS pending_review,
                COALESCE(SUM(CASE WHEN s.review_status = 1 THEN 1 ELSE 0 END), 0) AS approved,
                COALESCE(SUM(CASE WHEN s.review_status = 2 THEN 1 ELSE 0 END), 0) AS rejected
         FROM tasks t
         LEFT JOIN submissions s ON t.id = s.task_id
         ${whereClause}
         GROUP BY t.id
         ORDER BY t.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      return res.json(success({
        total: countResult?.total || 0,
        page: currentPage,
        page_size: pageSize,
        list: tasks.map(task => ({
          ...normalizeTaskRecord({
            ...task,
            platform: normalizePlatform(task.platform),
            reward_amount: parseFloat(task.reward_amount),
            status: parsePositiveInt(task.status, 1)
          }),
          product_name: task.product_name,
          submission_count: parseInt(task.submission_count || 0, 10),
          pending_review: parseInt(task.pending_review || 0, 10),
          approved: parseInt(task.approved || 0, 10),
          rejected: parseInt(task.rejected || 0, 10)
        }))
      }));
    } catch (err) {
      console.error('Get merchant tasks error:', err);
      return res.status(500).json(error(500, '服务器错误'));
    }
  }

  if (req.method === 'POST') {
    try {
      if (!merchantRoleAllowed(auth.merchant, ['owner', 'operator'])) {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '没有操作权限'));
      }

      const {
        platform,
        title,
        description,
        reward_amount,
        total_quota,
        search_keyword,
        shop_name,
        product_name,
        product_link,
        requirements,
        start_time,
        accept_start_time,
        end_time
      } = req.body;

      if (!title || !reward_amount || !total_quota) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少必填字段'));
      }

      const normalizedPlatform = normalizePlatform(platform);
      const parsedReward = parseFloat(reward_amount);
      const parsedQuota = parseInt(total_quota, 10);

      if (Number.isNaN(parsedReward) || parsedReward <= 0 || Number.isNaN(parsedQuota) || parsedQuota <= 0) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '奖励金额或名额不正确'));
      }

      const totalCost = parsedReward * parsedQuota;

      const result = process.env.DATABASE_URL
        ? await createTaskWithNeon({
          merchantId,
          operatorId,
          normalizedPlatform,
          title,
          description,
          parsedReward,
          parsedQuota,
          search_keyword,
          shop_name,
          product_name,
          product_link,
          requirements,
          start_time,
          accept_start_time,
          end_time,
          totalCost
        })
        : await db.transaction(async (connection) => {
        const [merchantRows] = await connection.query(
          'SELECT id, balance FROM merchants WHERE id = ? FOR UPDATE',
          [merchantId]
        );

        const merchant = merchantRows[0];
        if (!merchant) {
          throw new Error('merchant_not_found');
        }
        if (parseFloat(merchant.balance || 0) < totalCost) {
          throw new Error('insufficient_balance');
        }

        const [insertResult] = await connection.query(
          `INSERT INTO tasks
           (merchant_id, platform, title, description, reward_amount, total_quota, remaining_quota,
            search_keyword, shop_name, product_name, product_link, requirements, start_time, accept_start_time, end_time,
            status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
          [
            merchantId,
            normalizedPlatform,
            title,
            description || null,
            parsedReward,
            parsedQuota,
            parsedQuota,
            search_keyword || null,
            shop_name || null,
            product_name || null,
            product_link || null,
            parseRequirements(requirements),
            start_time || null,
            accept_start_time || null,
            end_time || null
          ]
        );

        await connection.query(
          'UPDATE merchants SET balance = balance - ?, updated_at = NOW() WHERE id = ?',
          [totalCost, merchantId]
        );

        await writeAuditLog(connection, {
          operator_type: 'merchant',
          operator_id: operatorId,
          action: 'task_create',
          target_type: 'task',
          target_id: insertResult.insertId,
          summary: `创建项目：${title}`,
          detail: {
            platform: normalizedPlatform,
            reward_amount: parsedReward,
            total_quota: parsedQuota
          }
        });

        return { task_id: insertResult.insertId };
      });

      require('../../../lib/cache').clearByPrefix('tasks:list:');
      return res.json(success(result, '项目已创建'));
    } catch (err) {
      console.error('Create task error:', err);
      if (err.message === 'insufficient_balance') {
        return res.status(400).json(error(ErrorCodes.INSUFFICIENT_BALANCE, '余额不足'));
      }
      if (err.message === 'merchant_not_found') {
        return res.status(404).json(error(ErrorCodes.USER_NOT_FOUND, '商家不存在'));
      }
      return res.status(500).json(error(500, '服务器错误'));
    }
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    try {
      if (!merchantRoleAllowed(auth.merchant, ['owner', 'operator'])) {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '没有操作权限'));
      }

      const taskId = req.body.id ?? req.body.task_id ?? req.query.id;
      const nextStatus = normalizeStatus(req.body.status ?? req.body.task_status);

      if (!taskId) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '缺少项目 ID'));
      }

      const editableKeys = [
        'platform',
        'title',
        'description',
        'search_keyword',
        'shop_name',
        'product_name',
        'product_link',
        'requirements',
        'start_time',
        'accept_start_time',
        'end_time'
      ];

      const hasEditableFields = editableKeys.some(key => Object.prototype.hasOwnProperty.call(req.body, key));
      if (!hasEditableFields && nextStatus === null) {
        return res.status(400).json(error(ErrorCodes.PARAM_ERROR, '没有可保存的修改'));
      }

      const result = await db.transaction(async (connection) => {
        const [rows] = await connection.query(
          'SELECT id, merchant_id, status FROM tasks WHERE id = ? FOR UPDATE',
          [taskId]
        );

        const task = rows[0];
        if (!task) {
          throw new Error('task_not_found');
        }
        if (task.merchant_id !== merchantId) {
          throw new Error('permission_denied');
        }
        const currentStatus = parsePositiveInt(task.status, 1);
        if (currentStatus === 3 && nextStatus !== 3 && !hasEditableFields) {
          throw new Error('task_closed');
        }

        const updatePayload = {};

        if (hasEditableFields) {
          const fields = [];
          const values = [];
          const pushField = (column, value) => {
            fields.push(`${column} = ?`);
            values.push(value);
          };

          if (Object.prototype.hasOwnProperty.call(req.body, 'platform')) {
            const value = normalizePlatform(req.body.platform);
            pushField('platform', value);
            updatePayload.platform = value;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
            pushField('title', req.body.title);
            updatePayload.title = req.body.title;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
            const value = req.body.description || null;
            pushField('description', value);
            updatePayload.description = value;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'search_keyword')) {
            const value = req.body.search_keyword || null;
            pushField('search_keyword', value);
            updatePayload.search_keyword = value;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'shop_name')) {
            const value = req.body.shop_name || null;
            pushField('shop_name', value);
            updatePayload.shop_name = value;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'product_name')) {
            const value = req.body.product_name || null;
            pushField('product_name', value);
            updatePayload.product_name = value;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'product_link')) {
            const value = req.body.product_link || null;
            pushField('product_link', value);
            updatePayload.product_link = value;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'requirements')) {
            const value = parseRequirements(req.body.requirements);
            pushField('requirements', value);
            updatePayload.requirements = value;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'start_time')) {
            const value = req.body.start_time || null;
            pushField('start_time', value);
            updatePayload.start_time = value;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'accept_start_time')) {
            const value = req.body.accept_start_time || null;
            pushField('accept_start_time', value);
            updatePayload.accept_start_time = value;
          }
          if (Object.prototype.hasOwnProperty.call(req.body, 'end_time')) {
            const value = req.body.end_time || null;
            pushField('end_time', value);
            updatePayload.end_time = value;
          }

          if (fields.length > 0) {
            await connection.query(
              `UPDATE tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
              [...values, taskId]
            );
            await writeAuditLog(connection, {
              operator_type: 'merchant',
              operator_id: operatorId,
              action: 'task_update',
              target_type: 'task',
              target_id: parseInt(taskId, 10),
              summary: `更新项目：${taskId}`,
              detail: updatePayload
            });
          }
        }

        if (nextStatus !== null) {
          if (currentStatus === 3 && nextStatus !== 3) {
            throw new Error('task_closed');
          }
          if (currentStatus !== nextStatus) {
            const refundAmount = nextStatus === 3 ? calculateCloseRefund(task) : 0;
            if (refundAmount > 0) {
              await connection.query(
                'UPDATE merchants SET balance = balance + ?, updated_at = NOW() WHERE id = ?',
                [refundAmount, merchantId]
              );
            }
            await connection.query(
              'UPDATE tasks SET status = ?, updated_at = NOW() WHERE id = ?',
              [nextStatus, taskId]
            );
            await writeAuditLog(connection, {
              operator_type: 'merchant',
              operator_id: operatorId,
              action: 'task_status_change',
              target_type: 'task',
              target_id: parseInt(taskId, 10),
              summary: `项目状态调整为 ${nextStatus}`,
              detail: { status: nextStatus, refund_amount: refundAmount }
            });
          }
        }

        return { task_id: parseInt(taskId, 10), status: nextStatus };
      });

      require('../../../lib/cache').clearByPrefix('tasks:list:');
      return res.json(success(result, hasEditableFields ? '项目已更新' : '项目状态已更新'));
    } catch (err) {
      console.error('Update task error:', err);
      if (err.message === 'task_not_found') {
        return res.status(404).json(error(ErrorCodes.TASK_NOT_FOUND, '项目不存在'));
      }
      if (err.message === 'permission_denied') {
        return res.status(403).json(error(ErrorCodes.NO_PERMISSION, '没有操作权限'));
      }
      if (err.message === 'task_closed') {
        return res.status(400).json(error(ErrorCodes.REVIEW_FAILED, '已关闭项目不能修改'));
      }
      return res.status(500).json(error(500, '服务器错误'));
    }
  }

  return res.status(405).json(error(405, '请求方法不支持'));
};
