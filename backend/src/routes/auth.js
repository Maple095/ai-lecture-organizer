import { Router } from 'express';
import { registerUser, loginUser, getUserById } from '../services/authService.js';
import { requireAuth } from '../middlewares/auth.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc 使用者註冊並自動建立登入 Session
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;
    const user = await registerUser({ email, password, displayName });

    // 自動建立 Session 登入態
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userDisplayName = user.displayName;

    return successResponse(res, user, 201, '註冊成功並已自動登入');
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

/**
 * @route POST /api/auth/login
 * @desc 使用者登入並建立 Session
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await loginUser({ email, password });

    // 設定 Session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userDisplayName = user.displayName;

    return successResponse(res, user, 200, '登入成功');
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

/**
 * @route POST /api/auth/logout
 * @desc 使用者登出 (銷毀 Session 並清除 Cookie)
 */
router.post('/logout', (req, res) => {
  if (!req.session) {
    return successResponse(res, null, 200, '已登出');
  }

  req.session.destroy((err) => {
    if (err) {
      return errorResponse(res, 'LOGOUT_FAILED', '登出時銷毀 Session 失敗', 500);
    }
    res.clearCookie('lecture_sid');
    return successResponse(res, null, 200, '登出成功');
  });
});

/**
 * @route GET /api/auth/me
 * @desc 取得目前登入使用者之完整個人資訊
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return errorResponse(res, 'USER_NOT_FOUND', '查無此使用者資料', 404);
    }
    return successResponse(res, user, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
