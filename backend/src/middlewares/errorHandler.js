import { errorResponse } from '../utils/response.js';
import { config } from '../config/index.js';

/**
 * 404 查無路由中介層
 */
export function notFoundHandler(req, res, next) {
  return errorResponse(
    res,
    'ROUTE_NOT_FOUND',
    `Cannot ${req.method} ${req.originalUrl}`,
    404
  );
}

/**
 * 全域異常捕捉中介層
 */
export function globalErrorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const errorMessage = err.message || 'An unexpected server error occurred';

  // 記錄錯誤日誌 (自動過濾敏感資訊)
  console.error(`[Unhandled Error] ${req.method} ${req.originalUrl} - ${statusCode} [${errorCode}]: ${errorMessage}`);
  if (config.env !== 'production' && err.stack) {
    console.error(err.stack);
  }

  // 判斷是否回傳錯誤堆疊 (僅限非生產環境)
  const details = config.env === 'development' ? { stack: err.stack } : null;

  return errorResponse(res, errorCode, errorMessage, statusCode, details);
}
