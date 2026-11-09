import { Router } from 'express';
import { query } from '../db/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = Router();

/**
 * @route GET /api/health
 * @desc 系統健康檢查端點 (校驗資料庫連線池與核心服務)
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    const dbRes = await query('SELECT 1 AS healthy, NOW() AS server_time');
    const dbLatency = Date.now() - startTime;

    return successResponse(res, {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        status: dbRes.rows[0].healthy === 1 ? 'connected' : 'degraded',
        serverTime: dbRes.rows[0].server_time,
        latencyMs: dbLatency,
      },
      environment: process.env.NODE_ENV || 'development',
    }, 200, 'System is healthy');
  } catch (err) {
    return errorResponse(
      res,
      'HEALTH_CHECK_FAILED',
      `Database connection failed: ${err.message}`,
      503
    );
  }
});

export default router;
