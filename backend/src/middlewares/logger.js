import morgan from 'morgan';

/**
 * 遮蔽敏感字串 (API 金鑰、密碼等)
 * @param {string} str
 * @returns {string}
 */
export function maskSensitive(str) {
  if (!str || typeof str !== 'string') return str;
  // 遮蔽 sk- 開頭的金鑰
  return str.replace(/sk-[a-zA-Z0-9_-]{8,}/g, (match) => {
    return `sk-${match.slice(3, 7)}...***`;
  });
}

/**
 * 客製化 Morgan 日誌中介層
 */
export const requestLogger = morgan((tokens, req, res) => {
  const method = tokens.method(req, res);
  const url = maskSensitive(tokens.url(req, res));
  const status = tokens.status(req, res);
  const responseTime = tokens['response-time'](req, res);
  return `[HTTP] ${method} ${url} ${status} - ${responseTime} ms`;
});
