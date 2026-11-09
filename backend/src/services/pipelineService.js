import crypto from 'crypto';
import fs from 'fs';
import { pool, query } from '../db/index.js';
import { storageAdapter } from '../storage/index.js';
import { getParserForFile } from '../parsers/index.js';
import { splitIntoChunks } from './chunkingService.js';

/**
 * 執行講義解析、切分與 Chunks 入庫流程
 * @param {string} documentId
 * @returns {Promise<{ success: boolean, chunkCount: number }>}
 */
export async function processDocument(documentId) {
  const client = await pool.connect();

  try {
    // 1. 鎖定並取得文件記錄
    await client.query('BEGIN');
    const docSql = `
      SELECT id, user_id, original_filename, storage_path, file_extension,
             mime_type, checksum_sha256, status, processing_version
      FROM documents
      WHERE id = $1
      FOR UPDATE;
    `;
    const docRes = await client.query(docSql, [documentId]);
    if (docRes.rowCount === 0) {
      throw new Error(`DOCUMENT_NOT_FOUND: Document ${documentId} does not exist`);
    }

    const doc = docRes.rows[0];

    // 更新為 processing
    await client.query(
      `UPDATE documents SET status = 'processing', processing_started_at = NOW(), error_message = NULL, updated_at = NOW() WHERE id = $1;`,
      [documentId]
    );
    await client.query('COMMIT');

    // 2. 自儲存層載入實體檔案 Buffer
    const fullPath = storageAdapter.resolveSafePath(doc.storage_path);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`FILE_NOT_FOUND: Physical file missing at ${doc.storage_path}`);
    }
    const buffer = await fs.promises.readFile(fullPath);

    // 3. 完整性驗證 (SHA-256 比對)
    const computedHash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (computedHash !== doc.checksum_sha256) {
      throw new Error(`FILE_CORRUPTED: SHA-256 mismatch (expected: ${doc.checksum_sha256}, actual: ${computedHash})`);
    }

    // 4. 解析多格式文件
    const parser = getParserForFile(doc.file_extension, doc.mime_type);
    const parseResult = await parser.parse(buffer, {
      documentId: doc.id,
      userId: doc.user_id,
      filename: doc.original_filename,
    });

    // 5. 文字標準化與 Chunking 切分 (保留 Source Location)
    const chunks = splitIntoChunks(parseResult.sections, {
      chunkSize: 500,
      overlap: 50,
      maxChunks: 1000,
    });

    // 6. 原子交易寫入 Chunks 與更新狀態
    await client.query('BEGIN');

    // 刪除舊 Chunks (MVCC 保證提交前外部搜尋無損)
    await client.query('DELETE FROM document_chunks WHERE document_id = $1;', [doc.id]);

    // 批次寫入新 Chunks
    const insertChunkSql = `
      INSERT INTO document_chunks (
        document_id, user_id, chunk_index, content, source_location, chunking_version, search_vector
      ) VALUES ($1, $2, $3, $4, $5, 1, to_tsvector('simple', $4));
    `;

    for (const chunk of chunks) {
      await client.query(insertChunkSql, [
        doc.id,
        doc.user_id,
        chunk.chunkIndex,
        chunk.content,
        JSON.stringify(chunk.sourceLocation),
      ]);
    }

    // 更新文件狀態為 completed
    const updateDocSql = `
      UPDATE documents
      SET status = 'completed',
          parser_type = $1,
          parser_version = $2,
          chunking_version = 1,
          error_message = NULL,
          updated_at = NOW()
      WHERE id = $3 AND status = 'processing';
    `;
    const updateRes = await client.query(updateDocSql, [
      parseResult.parserType,
      parseResult.parserVersion,
      doc.id,
    ]);

    if (updateRes.rowCount !== 1) {
      throw new Error(`CONCURRENT_MUTATION: Document state changed concurrently`);
    }

    await client.query('COMMIT');

    return {
      success: true,
      chunkCount: chunks.length,
      parserType: parseResult.parserType,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}

    // 記錄失敗狀態至資料庫
    try {
      await query(
        `UPDATE documents SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2;`,
        [err.message, documentId]
      );
    } catch {}

    console.error(`[Pipeline Error] Failed to process document ${documentId}:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}
