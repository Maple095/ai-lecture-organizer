import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { isValidEmail } from '../src/services/authService.js';
import { requireAuth } from '../src/middlewares/auth.js';
import { pool } from '../src/db/index.js';

describe('Step 2: Authentication & User Isolation Tests', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Input Validation & Utility Tests', () => {
    test('isValidEmail should accurately validate email strings', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('student.cs@university.edu.tw')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('2. Authentication Middleware (requireAuth)', () => {
    test('should return 401 UNAUTHORIZED if session does not exist or has no userId', () => {
      const mockReq = { session: null };
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const mockNext = jest.fn();

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should attach req.user and call next() if valid session exists', () => {
      const mockReq = {
        session: {
          userId: 'user-uuid-1234',
          userEmail: 'user@test.com',
          userDisplayName: 'Test Student',
        }
      };
      const mockRes = {};
      const mockNext = jest.fn();

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual({
        id: 'user-uuid-1234',
        email: 'user@test.com',
        displayName: 'Test Student',
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('3. Auth API Endpoints (Integration Tests with Mocked Pool)', () => {
    test('POST /api/auth/register should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'bad-email', password: 'password123', displayName: 'Student' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_EMAIL');
    });

    test('POST /api/auth/register should reject password shorter than 8 chars', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'valid@example.com', password: '12345', displayName: 'Student' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_PASSWORD_LENGTH');
    });

    test('POST /api/auth/register should reject duplicate email with 409', async () => {
      jest.spyOn(pool, 'query').mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('SELECT id FROM users')) {
          return { rowCount: 1, rows: [{ id: 'existing-id' }] };
        }
        return { rowCount: 0, rows: [] };
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'existing@example.com', password: 'password123', displayName: 'Student' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    test('POST /api/auth/register should succeed and set session cookie', async () => {
      const fakeUser = {
        id: 'new-user-uuid',
        email: 'newuser@example.com',
        display_name: 'New Student',
        created_at: new Date().toISOString(),
      };

      jest.spyOn(pool, 'query').mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('SELECT id FROM users')) {
          return { rowCount: 0, rows: [] };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO users')) {
          return { rowCount: 1, rows: [fakeUser] };
        }
        return { rowCount: 0, rows: [] };
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newuser@example.com', password: 'securePassword123!', displayName: 'New Student' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(fakeUser.id);
      expect(res.body.data.email).toBe(fakeUser.email);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    test('POST /api/auth/login should reject wrong credentials', async () => {
      jest.spyOn(pool, 'query').mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, email, password_hash')) {
          return { rowCount: 0, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notfound@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    test('POST /api/auth/login should verify password and establish session', async () => {
      const rawPassword = 'mySecretPassword123';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const fakeUser = {
        id: 'user-login-uuid',
        email: 'login@example.com',
        password_hash: hashedPassword,
        display_name: 'Login Student',
      };

      jest.spyOn(pool, 'query').mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT id, email, password_hash')) {
          return { rowCount: 1, rows: [fakeUser] };
        }
        return { rowCount: 0, rows: [] };
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com', password: rawPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(fakeUser.id);
      expect(res.body.data.email).toBe(fakeUser.email);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    test('GET /api/auth/me should return 401 when no session provided', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('POST /api/auth/logout should clear session', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
