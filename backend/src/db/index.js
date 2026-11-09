import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.db.connectionString,
  ssl: config.db.ssl,
  max: config.db.max,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
});

pool.on('error', (err) => {
  console.error('[Database Pool Error] Unexpected idle client error:', err.message);
});

/**
 * 執行參數化 SQL 查詢
 * @param {string} text - SQL 查詢字串 (例如 SELECT * FROM users WHERE id = $1)
 * @param {Array} [params] - 參數陣列
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development') {
      // 僅在開發環境輸出簡短執行耗時
      // console.log(`[SQL Query] (${duration}ms) rows=${res.rowCount}`);
    }
    return res;
  } catch (err) {
    console.error(`[SQL Error] ${err.message}\nQuery: ${text}`);
    throw err;
  }
}

/**
 * 取得獨立 client 供交易使用 (需手動 release)
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  return await pool.connect();
}
