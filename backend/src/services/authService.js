import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';

const SALT_ROUNDS = 10;

/**
 * 驗證 Email 格式
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * 使用者註冊
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 * @param {string} params.displayName
 * @returns {Promise<{ id: string, email: string, displayName: string, createdAt: string }>}
 */
export async function registerUser({ email, password, displayName }) {
  // 1. 欄位驗證
  if (!email || !isValidEmail(email)) {
    const err = new Error('請提供有效格式的 Email 電子郵件信箱');
    err.code = 'INVALID_EMAIL';
    err.status = 400;
    throw err;
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    const err = new Error('密碼長度至少需為 8 個字元');
    err.code = 'INVALID_PASSWORD_LENGTH';
    err.status = 400;
    throw err;
  }

  const name = displayName?.trim() || email.split('@')[0];

  // 2. 檢查 Email 是否已存在
  const checkSql = 'SELECT id FROM users WHERE email = $1';
  const checkRes = await query(checkSql, [email.toLowerCase().trim()]);
  if (checkRes.rowCount > 0) {
    const err = new Error('此 Email 已被註冊，請直接登入或使用其他信箱');
    err.code = 'EMAIL_ALREADY_EXISTS';
    err.status = 409;
    throw err;
  }

  // 3. 安全雜湊密碼 (bcryptjs)
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // 4. 寫入資料庫
  const insertSql = `
    INSERT INTO users (email, password_hash, display_name)
    VALUES ($1, $2, $3)
    RETURNING id, email, display_name, created_at;
  `;
  const insertRes = await query(insertSql, [email.toLowerCase().trim(), passwordHash, name]);
  const row = insertRes.rows[0];

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

/**
 * 使用者登入驗證
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<{ id: string, email: string, displayName: string }>}
 */
export async function loginUser({ email, password }) {
  if (!email || !password) {
    const err = new Error('請輸入 Email 與密碼');
    err.code = 'MISSING_CREDENTIALS';
    err.status = 400;
    throw err;
  }

  // 1. 查詢使用者
  const findSql = 'SELECT id, email, password_hash, display_name FROM users WHERE email = $1';
  const findRes = await query(findSql, [email.toLowerCase().trim()]);
  if (findRes.rowCount === 0) {
    const err = new Error('Email 或密碼錯誤');
    err.code = 'INVALID_CREDENTIALS';
    err.status = 401;
    throw err;
  }

  const user = findRes.rows[0];

  // 2. 比對密碼雜湊
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const err = new Error('Email 或密碼錯誤');
    err.code = 'INVALID_CREDENTIALS';
    err.status = 401;
    throw err;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
  };
}

/**
 * 依據 ID 取得使用者基本資訊
 * @param {string} id
 * @returns {Promise<{ id: string, email: string, displayName: string, createdAt: string } | null>}
 */
export async function getUserById(id) {
  const findSql = 'SELECT id, email, display_name, created_at FROM users WHERE id = $1';
  const res = await query(findSql, [id]);
  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}
