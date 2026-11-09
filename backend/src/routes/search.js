import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { searchChunks } from '../services/searchService.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = Router();

// 全文檢索強制通過身分驗證 (資料隔離防護)
router.use(requireAuth);

/**
 * @route GET /api/search
 * @desc 全文檢索講義內容 (PostgreSQL FTS + 中文 2-gram + GIN 索引)
 * @query q - 搜尋關鍵字
 * @query mode - 搜尋模式 (or | and | phrase，預設 or)
 * @query courseId - 課程 ID 過濾
 * @query limit - 回傳筆數 (預設 20)
 * @query offset - 分頁位移
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, mode, courseId, limit, offset } = req.query;

    if (!q || !q.trim()) {
      return successResponse(res, { query: '', total: 0, items: [] }, 200);
    }

    const items = await searchChunks({
      userId: req.user.id,
      queryStr: q,
      mode: mode || 'or',
      courseId: courseId || null,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return successResponse(res, {
      query: q,
      mode: mode || 'or',
      total: items.length,
      items,
    }, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
