import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db/index.js';
import { config } from './config/index.js';
import { requestLogger } from './middlewares/logger.js';
import { notFoundHandler, globalErrorHandler } from './middlewares/errorHandler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import documentsRouter from './routes/documents.js';
import searchRouter from './routes/search.js';
import chatRouter from './routes/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(options = {}) {
  const app = express();

  // ★ 關鍵修正 1：Render 反向代理信任（解決生產環境 Session Cookie 無法寫入問題）
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  // 1. 安全防護標頭 (Helmet)
  app.use(helmet({
    contentSecurityPolicy: false,
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

  // 4. Session 狀態管理 (express-session + connect-pg-simple)
  if (options.testUser) {
    app.use((req, res, next) => {
      req.session = {
        userId: options.testUser.id,
        userEmail: options.testUser.email,
        userDisplayName: options.testUser.displayName,
      };
      next();
    });
  } else {
    let sessionStore;
    if (options.sessionStore) {
      sessionStore = options.sessionStore;
    } else if (config.env === 'test' && !process.env.USE_PG_SESSION_TEST) {
      sessionStore = new session.MemoryStore();
    } else {
      const PgSession = connectPgSimple(session);
      sessionStore = new PgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: false,
      });
    }

    app.use(session({
      name: 'lecture_sid',
      store: sessionStore,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.isProduction, // 搭配 trust proxy 正常運作
        sameSite: 'lax',
        maxAge: config.session.maxAge,
      }
    }));
  }

  // 5. 脫敏請求日誌
  if (config.env !== 'test') {
    app.use(requestLogger);
  }

  // 6. 核心業務路由
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/chat', chatRouter);

  // ★ 關鍵修正 2：API 路由未匹配攔截（確保 /api/* 的 404 不會誤導向前端 HTML）
  app.all('/api/*', notFoundHandler);

  // ★ 關鍵修正 3：託管前端 Vite 打包後的 dist 靜態資源並啟用 SPA Fallback
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

  if (config.isProduction) {
    app.use(express.static(frontendDistPath));

    // 非 /api 的頁面路由全數轉導給前端 SPA 處理
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
  } else {
    // 開發或測試環境下若未匹配路由，由 notFoundHandler 統一回傳 404
    app.use(notFoundHandler);
  }

  // 8. 全域錯誤處理
  app.use(globalErrorHandler);

  return app;
}