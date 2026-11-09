import { createApp } from './app.js';
import { config } from './config/index.js';
import { pool } from './db/index.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[Server] AI Cloud Lecture Platform backend listening on port ${config.port} (env: ${config.env})`);
});

// 優雅關機處理 (Graceful Shutdown)
function handleShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    try {
      await pool.end();
      console.log('[Database] Database pool drained.');
      process.exit(0);
    } catch (err) {
      console.error('[Database Error] Error draining pool:', err);
      process.exit(1);
    }
  });

  // 超過 10 秒強制終止
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
