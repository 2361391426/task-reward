// 统一响应格式
function success(data = null, message = 'success') {
  return {
    code: 0,
    message,
    data
  };
}

function error(code, message, data = null) {
  const response = {
    code,
    message
  };

  if (data) {
    response.data = data;
  }

  return response;
}

// 错误码定义
const ErrorCodes = {
  SUCCESS: 0,
  PARAM_ERROR: 1001,
  NOT_LOGIN: 1002,
  NO_PERMISSION: 1003,
  USER_NOT_FOUND: 2001,
  TASK_NOT_FOUND: 2002,
  TASK_ENDED: 2003,
  QUOTA_FULL: 2004,
  ALREADY_SUBMITTED: 2005,
  INSUFFICIENT_BALANCE: 3001,
  WITHDRAWAL_AMOUNT_TOO_LOW: 3002,
  REVIEW_FAILED: 4001
};

module.exports = {
  success,
  error,
  ErrorCodes
};
