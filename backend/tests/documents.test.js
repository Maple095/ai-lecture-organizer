import { jest } from '@jest/globals';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { LocalStorageAdapter } from '../src/storage/index.js';
import { ALLOWED_EXTENSIONS } from '../src/services/documentService.js';
import { pool } from '../src/db/index.js';

describe('Step 3: Document Management System Tests', () => {
  let app;
  const testStorageDir = path.join(process.cwd(), 'tmp_test_storage');
  let testAdapter;

  beforeAll(() => {
    testAdapter = new LocalStorageAdapter(testStorageDir);
    app = createApp();
  });

  afterAll(async () => {
    if (fs.existsSync(testStorageDir)) {
      await fs.promises.rm(testStorageDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. StorageAdapter & Security Tests', () => {
    test('resolveSafePath should prevent Path Traversal attacks', () => {
      expect(() => {
        testAdapter.resolveSafePath('../../etc/passwd');
      }).toThrow('SECURITY_ERROR: Path traversal detected');
    });

    test('saveFile should save buffer and compute valid SHA-256', async () => {
      const content = Buffer.from('Hello Lecture Cloud Platform!');
      const expectedChecksum = crypto.createHash('sha256').update(content).digest('hex');
      const res = await testAdapter.saveFile('test/file1.txt', content);
      expect(res.storagePath).toBe('test/file1.txt');
      expect(res.checksum).toBe(expectedChecksum);
      expect(res.size).toBe(content.length);
      expect(testAdapter.fileExists('test/file1.txt')).toBe(true);
    });

    test('deleteFile should safely remove existing file', async () => {
      const deleted = await testAdapter.deleteFile('test/file1.txt');
      expect(deleted).toBe(true);
      expect(testAdapter.fileExists('test/file1.txt')).toBe(false);
    });
  });

  describe('2. Document Format Validation', () => {
    test('Allowed extensions should contain all 8 major formats', () => {
      expect(ALLOWED_EXTENSIONS['.pdf']).toBe('application/pdf');
      expect(ALLOWED_EXTENSIONS['.docx']).toBeDefined();
      expect(ALLOWED_EXTENSIONS['.xlsx']).toBeDefined();
      expect(ALLOWED_EXTENSIONS['.pptx']).toBeDefined();
      expect(ALLOWED_EXTENSIONS['.txt']).toBe('text/plain');
      expect(ALLOWED_EXTENSIONS['.md']).toBe('text/markdown');
      expect(ALLOWED_EXTENSIONS['.csv']).toBe('text/csv');
      expect(ALLOWED_EXTENSIONS['.png']).toBe('image/png');
    });
  });

  describe('3. Document API Authorization & Isolation (requireAuth)', () => {
    test('POST /api/documents/upload without session should return 401', async () => {
      const res = await request(app).post('/api/documents/upload');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('GET /api/documents without session should return 401', async () => {
      const res = await request(app).get('/api/documents');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('4. Document API with Authenticated Session (Mocked DB)', () => {
    const mockUserId = 'mock-user-uuid-111';
    let authApp;

    beforeAll(() => {
      authApp = createApp({
        testUser: {
          id: mockUserId,
          email: 'user1@test.com',
          displayName: 'User One',
        }
      });
    });

    test('POST /api/documents/upload should reject unsupported extension', async () => {
      const res = await request(authApp)
        .post('/api/documents/upload')
        .attach('file', Buffer.from('malicious content'), 'exploit.exe');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    test('POST /api/documents/upload should succeed for PDF lecture file', async () => {
      const fakeDoc = {
        id: 'doc-uuid-999',
        user_id: mockUserId,
        course_id: null,
        original_filename: 'Lecture01_Intro.pdf',
        storage_path: `users/${mockUserId}/doc-uuid-999/fake.pdf`,
        file_size: 1024,
        mime_type: 'application/pdf',
        file_extension: '.pdf',
        checksum_sha256: 'fakehash123456789',
        status: 'pending',
        processing_version: 1,
        created_at: new Date().toISOString(),
      };

      jest.spyOn(pool, 'query').mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO documents')) {
          return { rowCount: 1, rows: [fakeDoc] };
        }
        return { rowCount: 0, rows: [] };
      });

      const res = await request(authApp)
        .post('/api/documents/upload')
        .attach('file', Buffer.from('%PDF-1.4 Mock PDF Content'), 'Lecture01_Intro.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(fakeDoc.id);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.original_filename).toBe('Lecture01_Intro.pdf');
    });

    test('GET /api/documents should query documents for current user', async () => {
      const mockItems = [
        {
          id: 'doc-1',
          user_id: mockUserId,
          original_filename: 'Math.pdf',
          file_size: 2048,
          status: 'completed',
        }
      ];

      jest.spyOn(pool, 'query').mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('SELECT COUNT(*)')) {
          return { rowCount: 1, rows: [{ total: '1' }] };
        }
        if (typeof sql === 'string' && sql.includes('SELECT id, user_id')) {
          return { rowCount: 1, rows: mockItems };
        }
        return { rowCount: 0, rows: [] };
      });

      const res = await request(authApp).get('/api/documents?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.total).toBe(1);
    });

    test('GET /api/documents/:id should reject IDOR access when file belongs to another user', async () => {
      jest.spyOn(pool, 'query').mockImplementation(async () => {
        return { rowCount: 0, rows: [] };
      });

      const res = await request(authApp).get('/api/documents/other-user-doc-id');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DOCUMENT_NOT_FOUND');
    });

    test('DELETE /api/documents/:id should succeed and delete record', async () => {
      jest.spyOn(pool, 'query').mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('DELETE FROM documents')) {
          return { rowCount: 1, rows: [{ storage_path: 'users/mock/doc/fake.pdf' }] };
        }
        return { rowCount: 0, rows: [] };
      });

      const res = await request(authApp).delete('/api/documents/doc-to-delete');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
