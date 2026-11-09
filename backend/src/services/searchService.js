import { query } from '../db/index.js';

/**
 * 輕量中文 2-gram 切詞演算法
 * 中文字串切成連續 2-gram 雙字；英數字串保留為小寫單詞
 * 例如 "學習 PostgreSQL 資料庫" -> "學習 postgre sql 資料 料庫"
 * @param {string} text
 * @returns {Array<string>}
 */
export function tokenizeChinese2Gram(text) {
  if (!text || typeof text !== 'string') return [];

  // 清除特殊標點符號
  const clean = text.trim();
  const tokens = [];

  // 匹配連續中文、英數單詞
  const regex = /[\u4e00-\u9fa5]+|[a-zA-Z0-9_-]+/g;
  const matches = clean.match(regex) || [];

  for (const segment of matches) {
    if (/^[\u4e00-\u9fa5]+$/.test(segment)) {
      // 中文字串：產生 2-gram
      if (segment.length === 1) {
        tokens.push(segment);
      } else {
        for (let i = 0; i < segment.length - 1; i++) {
          tokens.push(segment.slice(i, i + 2));
        }
      }
    } else {
      // 英數字元：轉為小寫單詞
      tokens.push(segment.toLowerCase());
    }
  }

  return tokens;
}

/**
 * 構建 PostgreSQL tsquery 查詢字串
 * @param {Array<string>} tokens
 * @param {'or'|'and'|'phrase'} [mode='or']
 * @returns {string}
 */
export function buildTsQueryString(tokens, mode = 'or') {
  if (!tokens || tokens.length === 0) return '';

  // 跳脫 tsquery 保留字元 (: * & | ! <-> ( ))
  const safeTokens = tokens.map(t => t.replace(/['":*&|!<>()\\]/g, '')).filter(t => t.length > 0);
  if (safeTokens.length === 0) return '';

  if (mode === 'and') {
    return safeTokens.join(' & ');
  } else if (mode === 'phrase') {
    // PostgreSQL <-> 相鄰運算子
    return safeTokens.join(' <-> ');
  } else {
    // 預設 OR 相關性搜尋
    return safeTokens.join(' | ');
  }
}

/**
 * 執行全文檢索查詢 (多租戶隔離)
 * @param {Object} params
 * @param {string} params.userId - 目前登入使用者 ID (強制綁定)
 * @param {string} params.queryStr - 搜尋關鍵字
 * @param {'or'|'and'|'phrase'} [params.mode='or']
 * @param {string} [params.courseId]
 * @param {number} [params.limit=20]
 * @param {number} [params.offset=0]
 * @returns {Promise<Array<Object>>}
 */
export async function searchChunks({
  userId,
  queryStr,
  mode = 'or',
  courseId = null,
  limit = 20,
  offset = 0,
}) {
  if (!queryStr || typeof queryStr !== 'string' || !queryStr.trim()) {
    return [];
  }

  // 1. 中文 2-gram 切詞
  const tokens = tokenizeChinese2Gram(queryStr);
  if (tokens.length === 0) {
    return [];
  }

  // 2. 構建 tsquery 字串
  const tsQueryStr = buildTsQueryString(tokens, mode);
  if (!tsQueryStr) {
    return [];
  }

  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const off = Math.max(0, parseInt(offset, 10) || 0);

  // 3. 參數化 SQL 查詢 (強制 user_id 隔離，杜絕 IDOR)
  const params = [userId, tsQueryStr];
  let courseFilter = '';
  if (courseId) {
    params.push(courseId);
    courseFilter = `AND d.course_id = $${params.length}`;
  }

  params.push(l);
  const limitIdx = params.length;
  params.push(off);
  const offsetIdx = params.length;

  // 4. 使用 ts_rank_cd 進行相關度權重排序
  const sql = `
    SELECT c.id, c.document_id, c.chunk_index, c.content, c.source_location,
           d.original_filename, d.file_extension, d.course_id,
           ts_rank_cd(c.search_vector, to_tsquery('simple', $2)) AS rank
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.user_id = $1
      AND c.search_vector @@ to_tsquery('simple', $2)
      ${courseFilter}
    ORDER BY rank DESC, c.chunk_index ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const res = await query(sql, params);
  return res.rows;
}

export const searchService = {
  tokenizeChinese2Gram,
  buildTsQueryString,
  searchChunks,
};
