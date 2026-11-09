import { jest } from '@jest/globals';
import { normalizeText, splitIntoChunks } from '../src/services/chunkingService.js';

describe('Step 5: Document Chunking & Source Location Tests', () => {
  describe('1. Text Normalization Tests', () => {
    test('normalizeText should clean illegal control chars and collapse whitespace', () => {
      const raw = 'Hello\x00\x08 World!\r\nThis   is  a\ttest.\n';
      const clean = normalizeText(raw);
      expect(clean).toBe('Hello World!\nThis is a test.');
    });

    test('normalizeText should handle empty or null values', () => {
      expect(normalizeText('')).toBe('');
      expect(normalizeText(null)).toBe('');
    });
  });

  describe('2. Chunk Splitting & Overlap Tests', () => {
    test('splitIntoChunks should keep short section as single chunk', () => {
      const sections = [
        {
          text: '這是一段短篇教學內容，說明關聯式資料庫基本概念。',
          sourceLocation: { type: 'pdf', pageNumber: 1, bbox: [0, 0, 100, 100] }
        }
      ];

      const chunks = splitIntoChunks(sections, { chunkSize: 200, overlap: 20 });
      expect(chunks.length).toBe(1);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].content).toBe(sections[0].text);
      expect(chunks[0].sourceLocation.pageNumber).toBe(1);
    });

    test('splitIntoChunks should split long section with overlap and preserve source location', () => {
      const longText = '第一句重點說明。'.repeat(40); // 320 字元
      const sections = [
        {
          text: longText,
          sourceLocation: { type: 'docx', paragraphIndex: 5, headingPath: '資料庫正規化' }
        }
      ];

      const chunks = splitIntoChunks(sections, { chunkSize: 100, overlap: 20 });
      expect(chunks.length).toBeGreaterThan(1);

      // 檢查每個 chunk 都繼承了原段落的 sourceLocation
      for (const chunk of chunks) {
        expect(chunk.sourceLocation.type).toBe('docx');
        expect(chunk.sourceLocation.headingPath).toBe('資料庫正規化');
        expect(chunk.sourceLocation.paragraphIndex).toBe(5);
        expect(chunk.sourceLocation.chunkSlice).toBeDefined();
      }

      // 檢查序列編號連貫性
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[1].chunkIndex).toBe(1);
    });

    test('splitIntoChunks should enforce maxChunks limit', () => {
      const longText = '句子內容。'.repeat(200);
      const sections = [{ text: longText, sourceLocation: { type: 'txt', startLine: 1, endLine: 200 } }];

      const chunks = splitIntoChunks(sections, { chunkSize: 50, overlap: 10, maxChunks: 5 });
      expect(chunks.length).toBe(5);
    });
  });
});
