import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入 backend 根目錄之 .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  isProduction: process.env.NODE_ENV === 'production',
  
  db: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lecture_db',
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.PGMAX, 10) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  
  session: {
    secret: process.env.SESSION_SECRET || 'dev_session_secret_change_in_production_min_32_chars',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
  },
  
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(__dirname, '../../storage')),
  },
  
  ai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  }
};
