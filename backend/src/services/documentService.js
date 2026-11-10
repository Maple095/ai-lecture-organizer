import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { storageAdapter } from '../storage/index.js';

// 支援之副檔名與對應 MIME 類型白名單
export const ALLOWED_EXTENSIONS = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * 修復 Multer 在解析 multipart/form-data 時因預設 latin1 編碼導致的中文檔名亂碼問題
 * (例如 '3.2 è¬›ç¾©.pdf' 或 '3.2 æ•¸åˆ—èˆ‡ç´šæ•¸.pdf' 還原為 '3.2 數列與級數.pdf')
 * 
 * 重要：若字串本身已經含有 Unicode 字元 (charCode > 255，如 '數' 0x6578)，
 * 絕不可再經由 Buffer.from(filename, 'latin1') 轉換，否則 0x6578 & 0xFF 會被截斷為 0x78 ('x')，
 * 導致中文字元被直接洗成英文字母 'x'！
 * @param {string} filename 
 * @returns {string} 正確 UTF-8 編碼之檔名
 */
export function fixFilenameEncoding(filename) {
  if (!filename || typeof filename !== 'string') return '';
  
  // 若已包含非 Latin-1 字元 (如標準中文字、日韓文)，表示已經是完整 UTF-8 Unicode 字串，直接返回
  if (/[^\x00-\xFF]/.test(filename)) {
    return filename;
  }

  try {
    const decoded = Buffer.from(filename, 'latin1').toString('utf8');
    // 解碼後無無效 UTF-8 替代字元 (\uFFFD) 且確實包含多位元組非 ASCII 字元時，才採納還原結果
    if (!decoded.includes('\uFFFD') && /[^\x00-\x7F]/.test(decoded)) {
      return decoded;
    }
  } catch {
    // 忽略解碼異常，安全回退
  }
  return filename;
}

/**
 * 安全處理檔名：移除危險字元（如路徑穿越、null byte、斜線等），但完整保留所有 UTF-8 中文字元
 * 嚴禁將非 ASCII 字元替換為 x 或英數，保留所有繁體/簡體中文、日韓文、空格與標準符號
 * @param {string} filename
 * @returns {string} 安全且完整保留中文字元的檔名
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return 'unnamed_document';
  
  // 1. 還原可能被 latin1 誤譯的 UTF-8 中文檔名
  const decoded = fixFilenameEncoding(filename);

  // 2. 僅過濾真正具安全風險的路徑穿越或作業系統危險控制字元 (保留中文字元、空格、括號、底線等)
  let clean = decoded
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 移除 ASCII 控制字元
    .replace(/[/\\]/g, '_')                        // 斜線轉為底線防止路徑遍歷注入
    .replace(/^\.+/, '')                           // 移除開頭點防止隱藏檔
    .trim();

  return clean || 'unnamed_document';
}

/**
 * 上傳並保存原始講義檔案
 * @param {Object} params
 * @param {string} params.userId
 * @param {Object} params.file - multer file 物件 (包含 buffer, originalname, size, mimetype)
 * @param {string} [params.courseId]
 * @returns {Promise<Object>} 建立之 Document 資料表物件
 */
export async function uploadDocument({ userId, file, courseId = null }) {
  if (!file) {
    const err = new Error('請選擇要上傳的檔案');
    err.code = 'NO_FILE_PROVIDED';
    err.status = 400;
    throw err;
  }

  // 完整保留並安全處理繁簡中文檔名（絕對不將中文轉為 x）
  const originalFilename = sanitizeFilename(file.originalname);
  file.originalname = originalFilename;

  // 1. 檔案大小檢查
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const err = new Error(`檔案大小 (${(file.size / (1024 * 1024)).toFixed(2)}MB) 超過系統上限 20MB`);
    err.code = 'FILE_TOO_LARGE';
    err.status = 400;
    throw err;
  }

  // 2. 副檔名與格式檢查
  const ext = path.extname(originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS[ext]) {
    const err = new Error(`不支援的檔案格式: ${ext}。目前支援: PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, 圖片`);
    err.code = 'UNSUPPORTED_FILE_TYPE';
    err.status = 400;
    throw err;
  }

  const mimeType = ALLOWED_EXTENSIONS[ext] || file.mimetype || 'application/octet-stream';
  const docId = uuidv4();
  const fileStorageName = `${uuidv4()}${ext}`;
  const relativePath = path.posix.join('users', userId, docId, fileStorageName);

  // 3. 持久化寫入儲存層 (計算 SHA-256 Checksum)
  const saveResult = await storageAdapter.saveFile(relativePath, file.buffer);

  // 4. 寫入 documents 資料表
  const insertSql = `
    INSERT INTO documents (
      id, user_id, course_id, original_filename, storage_path, file_size,
      mime_type, file_extension, checksum_sha256, status, processing_version,
      retry_count, reprocess_count
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 1, 0, 0)
    RETURNING id, user_id, course_id, original_filename, storage_path, file_size,
              mime_type, file_extension, checksum_sha256, status, processing_version,
              created_at, updated_at;
  `;

  try {
    const res = await query(insertSql, [
      docId,
      userId,
      courseId || null,
      originalFilename,
      saveResult.storagePath,
      saveResult.size,
      mimeType,
      ext,
      saveResult.checksum,
    ]);
    return res.rows[0];
  } catch (err) {
    // 若 DB 寫入失敗，執行補償刪除已寫入實體檔案
    await storageAdapter.deleteFile(relativePath);
    throw err;
  }
}

/**
 * 查詢使用者文件清單 (嚴格多租戶 user_id 隔離)
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} [params.courseId]
 * @param {string} [params.status]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @returns {Promise<{ items: Array, total: number, page: number, limit: number }>}
 */
export async function listDocuments({ userId, courseId, status, page = 1, limit = 20 }) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const conditions = ['user_id = $1'];
  const params = [userId];

  if (courseId) {
    params.push(courseId);
    conditions.push(`course_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  const countSql = `SELECT COUNT(*) AS total FROM documents WHERE ${whereClause};`;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0].total, 10);

  params.push(l);
  const limitParamIdx = params.length;
  params.push(offset);
  const offsetParamIdx = params.length;

  const dataSql = `
    SELECT id, user_id, course_id, original_filename, file_size, mime_type,
           file_extension, checksum_sha256, status, error_message,
           created_at, updated_at
    FROM documents
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};
  `;
  const dataRes = await query(dataSql, params);

  return {
    items: dataRes.rows,
    total,
    page: p,
    limit: l,
  };
}

/**
 * 取得單一文件詳細資訊 (校驗 user_id 防止 IDOR)
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.userId
 * @returns {Promise<Object>}
 */
export async function getDocumentById({ id, userId }) {
  const sql = `
    SELECT id, user_id, course_id, original_filename, storage_path, file_size,
           mime_type, file_extension, checksum_sha256, status, error_message,
           processing_version, retry_count, reprocess_count, created_at, updated_at
    FROM documents
    WHERE id = $1 AND user_id = $2;
  `;
  const res = await query(sql, [id, userId]);
  if (res.rowCount === 0) {
    const err = new Error('查無此文件或您無權限存取');
    err.code = 'DOCUMENT_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return res.rows[0];
}

/**
 * 刪除文件與實體檔案 (多租戶隔離)
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.userId
 * @returns {Promise<boolean>}
 */
export async function deleteDocument({ id, userId }) {
  // 1. 刪除資料庫記錄 (外鍵關聯之 chunks, summaries 將自動 CASCADE 刪除)
  const deleteSql = `
    DELETE FROM documents
    WHERE id = $1 AND user_id = $2
    RETURNING storage_path;
  `;
  const res = await query(deleteSql, [id, userId]);
  if (res.rowCount === 0) {
    const err = new Error('查無此文件或您無權限刪除');
    err.code = 'DOCUMENT_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const storagePath = res.rows[0].storage_path;

  // 2. 刪除實體檔案；若刪除失敗則寫入 storage_cleanup_jobs 補償
  const deleted = await storageAdapter.deleteFile(storagePath);
  if (!deleted) {
    try {
      await query(
        `INSERT INTO storage_cleanup_jobs (storage_path, reason, status) VALUES ($1, 'doc_deleted_cleanup', 'pending')`,
        [storagePath]
      );
    } catch (cleanupErr) {
      console.error('[Cleanup Job Insert Error]:', cleanupErr.message);
    }
  }

  return true;
}
