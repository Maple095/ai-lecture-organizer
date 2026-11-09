import { errorResponse } from '../utils/response.js';

/**
 * 身分驗證中介層 (Authentication Middleware)
 * 驗證目前 HTTP 請求是否帶有有效的使用者 Session。
 * 成功時將使用者身分綁定於 req.user，嚴格禁止下游路由依賴客戶端傳入之 user_id。
 */
export function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return errorResponse(
      res,
      'UNAUTHORIZED',
      '請先登入後再進行此操作',
      401
    );
  }

  // 將經由伺服器端簽署認證之使用者資訊注入 req.user
  req.user = {
    id: req.session.userId,
    email: req.session.userEmail,
    displayName: req.session.userDisplayName,
  };

  next();
}
