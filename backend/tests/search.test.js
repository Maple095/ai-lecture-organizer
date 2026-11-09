import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  tokenizeChinese2Gram,
  buildTsQueryString,
  searchChunks,
} from '../src/services/searchService.js';
import { pool } from '../src/db/index.js';

describe('Step 6: Full-Text Search (Chinese 2-gram) Tests', () => {
  let app;
  const mockUserId = 'user-search-123';

  beforeAll(() => {
    app = createApp({
      testUser: {
        id: mockUserId,
        email: 'searcher@test.com',
        displayName: 'Search Student',
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Chinese 2-gram Tokenization Tests', () => {
    test('should slice continuous Chinese into 2-grams', () => {
      const tokens = tokenizeChinese2Gram('資料庫正規化');
      expect(tokens).toEqual(['資料', '料庫', '庫正', '正規', '規化']);
    });

    test('should handle mixed Chinese, English, and numbers correctly', () => {
      const tokens = tokenizeChinese2Gram('學習 PostgreSQL 15 深入淺出');
      expect(tokens).toContain('學習');
      expect(tokens).toContain('postgresql');
      expect(tokens).toContain('15');
      expect(tokens).toContain('深入');
      expect(tokens).toContain('入淺');
      expect(tokens).toContain('淺出');
    });

    test('should return single character if length is 1', () => {
      expect(tokenizeChinese2Gram('圖')).toEqual(['圖']);
    });

    test('should filter out standalone punctuation and whitespace', () => {
      expect(tokenizeChinese2Gram('，。？！：；')).toEqual([]);
      expect(tokenizeChinese2Gram('   ')).toEqual([]);
      expect(tokenizeChinese2Gram(null)).toEqual([]);
    });
  });

  describe('2. tsquery String Construction Tests', () => {
    test('buildTsQueryString should support OR mode (default)', () => {
      const queryStr = buildTsQueryString(['資料', '料庫'], 'or');
      expect(queryStr).toBe('資料 | 料庫');
    });

    test('buildTsQueryString should support AND mode', () => {
      const queryStr = buildTsQueryString(['資料', '料庫'], 'and');
      expect(queryStr).toBe('資料 & 料庫');
    });

    test('buildTsQueryString should support Phrase mode with <-> operator', () => {
      const queryStr = buildTsQueryString(['資料', '料庫'], 'phrase');
      expect(queryStr).toBe('資料 <-> 料庫');
    });

    test('buildTsQueryString should escape special tsquery syntax characters', () => {
      const queryStr = buildTsQueryString(["'bad':*&|!<>"], 'or');
      expect(queryStr).toBe('bad');
    });
  });

  describe('3. Search API & Multi-tenant Isolation Tests', () => {
    test('GET /api/search without auth should return 401', async () => {
      const unauthApp = createApp();
      const res = await request(unauthApp).get('/api/search?q=資料庫');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('GET /api/search with empty query should return empty array without querying DB', async () => {
      const querySpy = jest.spyOn(pool, 'query');
      const res = await request(app).get('/api/search?q=   ');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.items).toEqual([]);
      expect(querySpy).not.toHaveBeenCalled();
    });

    test('GET /api/search should query with current user_id and return ranked results', async () => {
      const mockRows = [
        {
          id: 'chunk-1',
          document_id: 'doc-1',
          chunk_index: 0,
          content: '資料庫正規化是設計核心技術',
          source_location: { type: 'pdf', pageNumber: 3 },
          original_filename: 'DB_Lecture.pdf',
          file_extension: '.pdf',
          rank: 0.85,
        }
      ];

      const querySpy = jest.spyOn(pool, 'query').mockImplementation(async (sql, params) => {
        expect(params[0]).toBe(mockUserId); // 強制校驗 user_id 隔離
        return { rowCount: 1, rows: mockRows };
      });

      const res = await request(app).get('/api/search?q=資料庫&mode=or');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].original_filename).toBe('DB_Lecture.pdf');
      expect(res.body.data.items[0].source_location.pageNumber).toBe(3);
      expect(querySpy).toHaveBeenCalled();
    });
  });
});
