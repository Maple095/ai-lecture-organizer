import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db/index.js';
import { config } from './config/index.js';
import { requestLogger } from './middlewares/logger.js';
import { notFoundHandler, globalErrorHandler } from './middlewares/errorHandler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import documentsRouter from './routes/documents.js';

export function createApp(options = {}) {
  const app = express();

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
    // 測試專用身分注入中介層
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
        secure: config.isProduction,
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

  // 7. 404 處理
  app.use(notFoundHandler);

  // 8. 全域錯誤處理
  app.use(globalErrorHandler);

  return app;
}
