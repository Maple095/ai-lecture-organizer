import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AiProviderAdapter, aiProvider, resolveChatCompletionUrl } from '../src/ai/providerAdapter.js';
import { searchService } from '../src/services/searchService.js';
import { askQuestionWithRag } from '../src/services/aiService.js';

describe('Step 7: AI RAG & Provider Adapter Tests', () => {
  let app;
  const mockUserId = 'user-ai-999';

  beforeAll(() => {
    app = createApp({
      testUser: {
        id: mockUserId,
        email: 'student_ai@test.com',
        displayName: 'AI Student',
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. AiProviderAdapter Unit Tests', () => {
    test('should throw error if apiKey is missing', async () => {
      const adapter = new AiProviderAdapter({ apiKey: '' });
      await expect(adapter.generateChatCompletion({ messages: [] })).rejects.toThrow('MISSING_API_KEY');
    });

    test('resolveChatCompletionUrl should properly normalize Gemini and other baseUrls without 404 or double slashes', () => {
      expect(resolveChatCompletionUrl('https://generativelanguage.googleapis.com/v1beta/openai/'))
        .toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
      expect(resolveChatCompletionUrl('https://generativelanguage.googleapis.com/v1beta/openai'))
        .toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
      expect(resolveChatCompletionUrl('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'))
        .toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
      expect(resolveChatCompletionUrl('https://generativelanguage.googleapis.com/v1beta/'))
        .toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
      expect(resolveChatCompletionUrl('https://generativelanguage.googleapis.com'))
        .toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
      expect(resolveChatCompletionUrl('https://api.openai.com'))
        .toBe('https://api.openai.com/v1/chat/completions');
      expect(resolveChatCompletionUrl('https://api.openai.com/v1'))
        .toBe('https://api.openai.com/v1/chat/completions');
      expect(resolveChatCompletionUrl('https://api.groq.com'))
        .toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(resolveChatCompletionUrl(''))
        .toBe('https://api.openai.com/v1/chat/completions');
    });
  });

  describe('2. RAG Retrieval & Prompt Assembly Tests', () => {
    test('should honestly report insufficient context when no chunks match', async () => {
      // Mock searchChunks to return empty array
      jest.spyOn(searchService, 'searchChunks').mockResolvedValue([]);

      const result = await askQuestionWithRag({
        userId: mockUserId,
        question: '請問什麼是量子糾纏？',
      });

      expect(result.hasSufficientContext).toBe(false);
      expect(result.citations).toEqual([]);
      expect(result.answer).toContain('查無與此問題相關的參考內容');
    });

    test('should assemble context and return answer with citations when chunks match', async () => {
      const mockChunks = [
        {
          id: 'chunk-db-1',
          document_id: 'doc-db',
          chunk_index: 0,
          content: '第一正規化 (1NF) 要求每個儲存格不可再分割，必須為原子值。',
          source_location: { type: 'pdf', pageNumber: 5 },
          original_filename: 'Database_Concepts.pdf',
        }
      ];

      jest.spyOn(searchService, 'searchChunks').mockResolvedValue(mockChunks);
      jest.spyOn(aiProvider, 'generateChatCompletion').mockResolvedValue({
        content: '第一正規化 (1NF) 的核心定義在於每個儲存格資料必須具備原子性 [來源 1]。',
        usage: { total_tokens: 150 },
        model: 'gpt-4o-mini',
      });

      const result = await askQuestionWithRag({
        userId: mockUserId,
        question: '何謂第一正規化？',
      });

      expect(result.hasSufficientContext).toBe(true);
      expect(result.answer).toContain('[來源 1]');
      expect(result.citations.length).toBe(1);
      expect(result.citations[0].filename).toBe('Database_Concepts.pdf');
      expect(result.citations[0].sourceLocation.pageNumber).toBe(5);
    });
  });

  describe('3. Chat Endpoints HTTP Tests', () => {
    test('POST /api/chat/ask without auth should return 401', async () => {
      const unauthApp = createApp();
      const res = await request(unauthApp)
        .post('/api/chat/ask')
        .send({ question: '測試問題' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('POST /api/chat/ask with valid session should return RAG answer', async () => {
      jest.spyOn(searchService, 'searchChunks').mockResolvedValue([
        {
          id: 'c-1',
          document_id: 'd-1',
          chunk_index: 0,
          content: '資料結構中的二元樹是層次結構。',
          source_location: { type: 'docx', paragraphIndex: 3 },
          original_filename: 'DataStructures.docx',
        }
      ]);

      jest.spyOn(aiProvider, 'generateChatCompletion').mockResolvedValue({
        content: '二元樹是一種具有樹狀階層的非線性資料結構 [來源 1]。',
        usage: {},
        model: 'gpt-4o-mini',
      });

      const res = await request(app)
        .post('/api/chat/ask')
        .send({ question: '什麼是二元樹？' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toContain('二元樹');
      expect(res.body.data.citations.length).toBe(1);
      expect(res.body.data.citations[0].filename).toBe('DataStructures.docx');
    });

    test('POST /api/chat/ask with custom apiKey should instantiate custom provider and return answer', async () => {
      jest.spyOn(searchService, 'searchChunks').mockResolvedValue([
        {
          id: 'c-custom-1',
          document_id: 'd-custom-1',
          chunk_index: 0,
          content: '作業系統的核心包含行程排班與記憶體管理。',
          source_location: { type: 'pdf', pageNumber: 2 },
          original_filename: 'OS_Concepts.pdf',
        }
      ]);

      const spyCustomGenerate = jest.spyOn(AiProviderAdapter.prototype, 'generateChatCompletion').mockResolvedValue({
        content: '行程排班是作業系統核心的關鍵模組 [來源 1]。',
        usage: {},
        model: 'deepseek-chat',
      });

      const res = await request(app)
        .post('/api/chat/ask')
        .send({
          question: '行程排班的作用是什麼？',
          apiKey: 'sk-custom-test-key-12345',
          baseUrl: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toContain('行程排班');
      expect(res.body.data.model).toBe('deepseek-chat');
      expect(spyCustomGenerate).toHaveBeenCalled();
    });
  });
});
