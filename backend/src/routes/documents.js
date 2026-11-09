import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.js';
import {
  uploadDocument,
  listDocuments,
  getDocumentById,
  deleteDocument,
  MAX_FILE_SIZE_BYTES
} from '../services/documentService.js';
import { processDocument } from '../services/pipelineService.js';
import { storageAdapter } from '../storage/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = Router();

// 設定記憶體上傳緩衝區 (20MB 上限)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  }
});

// 所有文件操作強制通過身分驗證
router.use(requireAuth);

/**
 * @route POST /api/documents/upload
 * @desc 上傳並持久化保存講義檔案 (支援自動背景觸發解析)
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    const courseId = req.body.courseId || null;
    const document = await uploadDocument({
      userId: req.user.id,
      file: req.file,
      courseId,
    });

    // 非同步自動觸發背景解析 (不阻塞 HTTP 回應)
    processDocument(document.id).catch(err => {
      console.warn(`[Background Parse Notice] Doc ${document.id}: ${err.message}`);
    });

    return successResponse(res, document, 201, '檔案上傳成功，已持久化保存');
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

/**
 * @route POST /api/documents/:id/process
 * @desc 手動觸發文件解析與 Chunking
 */
router.post('/:id/process', async (req, res, next) => {
  try {
    // 驗證使用者所有權
    await getDocumentById({
      id: req.params.id,
      userId: req.user.id,
    });

    const result = await processDocument(req.params.id);
    return successResponse(res, result, 200, '文件解析與分塊完成');
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

/**
 * @route GET /api/documents
 * @desc 取得目前登入使用者之文件清單
 */
router.get('/', async (req, res, next) => {
  try {
    const { courseId, status, page, limit } = req.query;
    const result = await listDocuments({
      userId: req.user.id,
      courseId,
      status,
      page,
      limit,
    });
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/documents/:id
 * @desc 取得單一文件詳細資訊
 */
router.get('/:id', async (req, res, next) => {
  try {
    const document = await getDocumentById({
      id: req.params.id,
      userId: req.user.id,
    });
    return successResponse(res, document, 200);
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

/**
 * @route GET /api/documents/:id/download
 * @desc 原始檔案安全串流下載 (RFC 5987)
 */
router.get('/:id/download', async (req, res, next) => {
  try {
    const doc = await getDocumentById({
      id: req.params.id,
      userId: req.user.id,
    });

    const fileStream = storageAdapter.getFileStream(doc.storage_path);

    const encodedFilename = encodeURIComponent(doc.original_filename);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader('ETag', `"${doc.checksum_sha256}"`);
    res.setHeader('Content-Length', doc.file_size);

    fileStream.pipe(res);
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

/**
 * @route DELETE /api/documents/:id
 * @desc 刪除文件記錄與實體檔案
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteDocument({
      id: req.params.id,
      userId: req.user.id,
    });
    return successResponse(res, { id: req.params.id }, 200, '文件與實體檔案已成功刪除');
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

export default router;
