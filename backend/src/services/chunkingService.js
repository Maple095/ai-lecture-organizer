/**
 * 文字標準化清理
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '') // 移除非法控制字元
    .replace(/\r\n/g, '\n') // 統一換行符
    .replace(/[ \t]+/g, ' ') // 連續空白合併
    .trim();
}

/**
 * 依據段落與長度切分文字，並保留來源定位資訊
 * @param {Array<{ text: string, sourceLocation: Object }>} sections
 * @param {Object} [options]
 * @param {number} [options.chunkSize=500] - 每個分塊目標字元數
 * @param {number} [options.overlap=50] - 分塊重疊字元數
 * @param {number} [options.maxChunks=1000] - 單份文件最大分塊上限
 * @returns {Array<{ chunkIndex: number, content: string, sourceLocation: Object }>}
 */
export function splitIntoChunks(sections, options = {}) {
  const chunkSize = options.chunkSize || 500;
  const overlap = options.overlap || 50;
  const maxChunks = options.maxChunks || 1000;

  const chunks = [];
  let chunkIndex = 0;

  for (const section of sections) {
    if (chunks.length >= maxChunks) break;

    const normalized = normalizeText(section.text);
    if (!normalized) continue;

    // 若該段落長度小於等於 chunkSize，直接作為單一 Chunk
    if (normalized.length <= chunkSize) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: normalized,
        sourceLocation: section.sourceLocation || { type: 'unknown' },
      });
      continue;
    }

    // 若長度超過 chunkSize，依據重疊窗口滑動切分
    let start = 0;
    while (start < normalized.length) {
      if (chunks.length >= maxChunks) break;

      let end = start + chunkSize;
      // 盡量在標點符號或換行處中斷
      if (end < normalized.length) {
        const punctuationIdx = normalized.lastIndexOf('。', end);
        const newlineIdx = normalized.lastIndexOf('\n', end);
        const commaIdx = normalized.lastIndexOf('，', end);
        const bestBreak = Math.max(punctuationIdx, newlineIdx, commaIdx);
        if (bestBreak > start + (chunkSize / 2)) {
          end = bestBreak + 1;
        }
      }

      const chunkText = normalized.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: chunkText,
          sourceLocation: {
            ...section.sourceLocation,
            chunkSlice: [start, end],
          },
        });
      }

      start = end - overlap;
      if (start >= normalized.length || end >= normalized.length) {
        break;
      }
    }
  }

  return chunks;
}
