import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { maskSensitive } from '../src/middlewares/logger.js';
import { successResponse, errorResponse } from '../src/utils/response.js';

describe('Step 1: Backend Foundation Tests', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('1. API Response Utility Tests', () => {
    test('successResponse should format response correctly', () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      successResponse(mockRes, { item: 1 }, 201, 'Created');
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { item: 1 },
        message: 'Created',
      });
    });

    test('errorResponse should format response correctly', () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      errorResponse(mockRes, 'TEST_ERROR', 'Something went wrong', 400, { field: 'email' });
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Something went wrong',
          details: { field: 'email' },
        },
      });
    });
  });

  describe('2. Sensitive Log Masking Tests (T27 Rule)', () => {
    test('maskSensitive should mask sk- API keys', () => {
      const rawUrl = '/api/chat?key=sk-1234567890abcdef12345678';
      const masked = maskSensitive(rawUrl);
      expect(masked).not.toContain('1234567890abcdef12345678');
      expect(masked).toContain('sk-1234...***');
    });

    test('maskSensitive should leave non-sensitive text untouched', () => {
      const normal = '/api/health';
      expect(maskSensitive(normal)).toBe('/api/health');
    });
  });

  describe('3. HTTP Routing and 404 Handler Tests', () => {
    test('Unregistered route should return 404 ROUTE_NOT_FOUND', async () => {
      const res = await request(app).get('/api/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });
  });

  describe('4. Health Check Route Structure', () => {
    test('GET /api/health should return a structured response', async () => {
      const res = await request(app).get('/api/health');
      // If DB is offline without live PG, it returns 503; if online, 200.
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('healthy');
      } else {
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('HEALTH_CHECK_FAILED');
      }
    });
  });
});
