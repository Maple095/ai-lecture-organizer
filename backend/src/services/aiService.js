import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { searchService } from './searchService.js';
import { aiProvider, AiProviderAdapter } from '../ai/providerAdapter.js';

/**
 * 執行基於檢索內容的 RAG 智慧問答
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.question
 * @param {string} [params.documentId]
 * @param {string} [params.apiKey] - 自訂 API 金鑰 (選填，優先採用)
 * @param {string} [params.baseUrl] - 自訂 API Base URL (選填)
 * @param {string} [params.model] - 自訂模型名稱 (選填)
 * @returns {Promise<{ answer: string, citations: Array<Object>, hasSufficientContext: boolean, model?: string }>}
 */
export async function askQuestionWithRag({
  userId,
  question,
  documentId = null,
  apiKey = null,
  baseUrl = null,
  model = null
}) {
  if (!question || !question.trim()) {
    const err = new Error('請輸入欲提問的問題');
    err.code = 'EMPTY_QUESTION';
    err.status = 400;
    throw err;
  }

  // 1. 檢索相關講義 Chunks (多租戶隔離保護)
  const chunks = await searchService.searchChunks({
    userId,
    queryStr: question,
    mode: 'or',
    limit: 6,
  });

  const citations = chunks.map((c, idx) => ({
    citationIndex: idx + 1,
    chunkId: c.id,
    documentId: c.document_id,
    filename: c.original_filename,
    sourceLocation: c.source_location,
    snippet: c.content.slice(0, 200),
  }));

  // 2. 若完全沒有檢索到任何講義內容，誠實回覆使用者
  if (chunks.length === 0) {
    return {
      answer: '抱歉，在您目前上傳的講義中查無與此問題相關的參考內容。請確認是否已上傳相應科目的講義，或嘗試換個關鍵字提問。',
      citations: [],
      hasSufficientContext: false,
    };
  }

  // 3. 組裝 Context 提示詞
  const contextText = chunks.map((c, idx) => {
    return `[來源 ${idx + 1}] 檔案: ${c.original_filename}\n內容: ${c.content}`;
  }).join('\n\n');

  const systemPrompt = `你是一位專業且嚴謹的大學課程助教。
請「嚴格依據」下方提供的【參考講義片段】回答使用者的問題。
規則：
1. 你的回答必須完全基於提供的參考講義內容，嚴禁自行編造或引入未提及的事實。
2. 在回答每項重點或陳述時，請在句末精確引用對應的來源標記，例如 [來源 1] 或 [來源 2]。
3. 若參考講義中的內容不足以完整回答該問題，請明確說明講義僅涵蓋哪些部分，不可胡亂推測。
4. 使用繁體中文親切、條理分明地回覆。`;

  const userPrompt = `【參考講義片段】：
${contextText}

【學生提問】：
${question}`;

  // 4. 動態決定 AI Provider 實例 (優先採用前端使用者傳入之自訂金鑰，未提供則回退伺服器預設 aiProvider)
  const provider = (apiKey && apiKey.trim())
    ? new AiProviderAdapter({ apiKey: apiKey.trim(), baseUrl, model })
    : aiProvider;

  const aiResult = await provider.generateChatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
  });

  return {
    answer: aiResult.content,
    citations,
    hasSufficientContext: true,
    model: aiResult.model,
  };
}

/**
 * 建立新對話 Session
 */
export async function createChatSession({ userId, title, documentId = null }) {
  const sessionId = uuidv4();
  const sessionTitle = title || '新講義問答對話';

  const sql = `
    INSERT INTO chat_sessions (id, user_id, document_id, title)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, document_id, title, created_at, updated_at;
  `;
  const res = await query(sql, [sessionId, userId, documentId || null, sessionTitle]);
  return res.rows[0];
}

/**
 * 取得使用者的對話 Session 清單
 */
export async function listChatSessions({ userId }) {
  const sql = `
    SELECT id, user_id, document_id, title, created_at, updated_at
    FROM chat_sessions
    WHERE user_id = $1
    ORDER BY updated_at DESC;
  `;
  const res = await query(sql, [userId]);
  return res.rows;
}

/**
 * 取得特定 Session 的對話歷史訊息
 */
export async function getChatMessages({ sessionId, userId }) {
  // 驗證 Session 所有權
  const checkSql = `SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2;`;
  const checkRes = await query(checkSql, [sessionId, userId]);
  if (checkRes.rowCount === 0) {
    const err = new Error('查無此對話紀錄或無權限存取');
    err.code = 'SESSION_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const sql = `
    SELECT id, session_id, role, content, source_chunks, created_at
    FROM chat_messages
    WHERE session_id = $1 AND user_id = $2
    ORDER BY created_at ASC;
  `;
  const res = await query(sql, [sessionId, userId]);
  return res.rows;
}

/**
 * 儲存一筆對話訊息
 */
export async function saveChatMessage({ sessionId, userId, role, content, sourceChunks = null }) {
  const msgId = uuidv4();
  const sql = `
    INSERT INTO chat_messages (id, session_id, user_id, role, content, source_chunks)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, session_id, role, content, source_chunks, created_at;
  `;
  const res = await query(sql, [
    msgId,
    sessionId,
    userId,
    role,
    content,
    sourceChunks ? JSON.stringify(sourceChunks) : null
  ]);
  return res.rows[0];
}
