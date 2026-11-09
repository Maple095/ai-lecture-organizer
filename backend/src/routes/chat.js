import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  askQuestionWithRag,
  createChatSession,
  listChatSessions,
  getChatMessages,
  saveChatMessage,
} from '../services/aiService.js';
import { successResponse, errorResponse } from '../utils/response.js';

const router = Router();

// 所有 AI 服務強制通過身分驗證
router.use(requireAuth);

/**
 * @route POST /api/chat/ask
 * @desc 快速 RAG 提問端點 (檢索關聯講義並呼叫 AI 生成附帶引用來源之回答)
 */
router.post('/ask', async (req, res, next) => {
  try {
    const { question, documentId } = req.body;
    const result = await askQuestionWithRag({
      userId: req.user.id,
      question,
      documentId,
    });
    return successResponse(res, result, 200);
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

/**
 * @route POST /api/chat/sessions
 * @desc 建立新對話 Session
 */
router.post('/sessions', async (req, res, next) => {
  try {
    const { title, documentId } = req.body;
    const session = await createChatSession({
      userId: req.user.id,
      title,
      documentId,
    });
    return successResponse(res, session, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/chat/sessions
 * @desc 取得使用者對話 Session 清單
 */
router.get('/sessions', async (req, res, next) => {
  try {
    const sessions = await listChatSessions({ userId: req.user.id });
    return successResponse(res, sessions, 200);
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/chat/sessions/:sessionId/messages
 * @desc 取得特定 Session 之歷史訊息
 */
router.get('/sessions/:sessionId/messages', async (req, res, next) => {
  try {
    const messages = await getChatMessages({
      sessionId: req.params.sessionId,
      userId: req.user.id,
    });
    return successResponse(res, messages, 200);
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

/**
 * @route POST /api/chat/sessions/:sessionId/messages
 * @desc 在對話中發送使用者提問，並儲存 AI 回答
 */
router.post('/sessions/:sessionId/messages', async (req, res, next) => {
  try {
    const { content } = req.body;
    const sessionId = req.params.sessionId;

    // 1. 儲存使用者提問
    await saveChatMessage({
      sessionId,
      userId: req.user.id,
      role: 'user',
      content,
    });

    // 2. 執行 RAG 生成 AI 回答
    const ragResult = await askQuestionWithRag({
      userId: req.user.id,
      question: content,
    });

    // 3. 儲存 AI 回覆
    const aiMessage = await saveChatMessage({
      sessionId,
      userId: req.user.id,
      role: 'assistant',
      content: ragResult.answer,
      sourceChunks: ragResult.citations,
    });

    return successResponse(res, {
      message: aiMessage,
      citations: ragResult.citations,
    }, 201);
  } catch (err) {
    if (err.status) {
      return errorResponse(res, err.code, err.message, err.status);
    }
    next(err);
  }
});

export default router;
