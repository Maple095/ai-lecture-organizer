import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger } from './middlewares/logger.js';
import { notFoundHandler, globalErrorHandler } from './middlewares/errorHandler.js';
import healthRouter from './routes/health.js';

export function createApp() {
  const app = express();

  // 1. 安全防護標頭 (Helmet)
  app.use(helmet({
    contentSecurityPolicy: false, // 允許前端 API 正常通訊，具體 CSP 在 preview 路由嚴格套用
    crossOriginEmbedderPolicy: false,
  }));

  // 2. CORS 跨域設定
  app.use(cors({
    origin: true,
    credentials: true,
  }));

  // 3. 請求解析
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // 4. 脫敏請求日誌
  if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
  }

  // 5. 核心健康檢查路由
  app.use('/api/health', healthRouter);

  // 6. 404 處理
  app.use(notFoundHandler);

  // 7. 全域錯誤處理
  app.use(globalErrorHandler);

  return app;
}
