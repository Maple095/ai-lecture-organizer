/**
 * 統一 API 成功回應格式
 * @param {import('express').Response} res
 * @param {*} data - 回傳主體資料
 * @param {number} [statusCode=200]
 * @param {string} [message]
 */
export function successResponse(res, data = null, statusCode = 200, message = null) {
  const responseBody = {
    success: true,
    data,
  };
  if (message) {
    responseBody.message = message;
  }
  return res.status(statusCode).json(responseBody);
}

/**
 * 統一 API 失敗回應格式
 * @param {import('express').Response} res
 * @param {string} code - 錯誤代碼 (例如 NOT_FOUND, UNAUTHORIZED)
 * @param {string} message - 可讀之錯誤訊息
 * @param {number} [statusCode=400]
 * @param {*} [details=null] - 選用之錯誤細節
 */
export function errorResponse(res, code, message, statusCode = 400, details = null) {
  const responseBody = {
    success: false,
    error: {
      code,
      message,
    }
  };
  if (details !== null && details !== undefined) {
    responseBody.error.details = details;
  }
  return res.status(statusCode).json(responseBody);
}
