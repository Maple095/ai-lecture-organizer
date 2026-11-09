import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const { login, register } = useAuth();

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('請填寫所有必填欄位');
      return;
    }

    if (password.length < 8) {
      setLocalError('密碼長度需至少為 8 個字元');
      return;
    }

    try {
      setSubmitting(true);
      if (isRegister) {
        await register(email, password, displayName);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(2px)'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '420px',
        margin: '1rem',
        boxShadow: 'var(--shadow-md)',
        animation: 'fadeIn 0.2s ease-in-out'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
            {isRegister ? '註冊新帳號' : '使用者登入'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            &times;
          </button>
        </div>

        {localError && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: 'var(--danger)',
            padding: '0.625rem 0.75rem',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            marginBottom: '1rem'
          }}>
            {localError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
                姓名 / 暱稱
              </label>
              <input
                type="text"
                placeholder="例如：張同學"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.875rem',
                  outline: 'none'
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
              Email 電子郵件 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-color)',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.375rem' }}>
              密碼 (至少 8 個字元) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-color)',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            className="primary"
            disabled={submitting}
            style={{ width: '100%', padding: '0.625rem', marginBottom: '1rem', fontSize: '0.925rem' }}
          >
            {submitting ? '處理中...' : isRegister ? '立即註冊' : '登入系統'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {isRegister ? (
            <span>
              已有帳號？{' '}
              <a
                href="#login"
                onClick={(e) => { e.preventDefault(); setIsRegister(false); setLocalError(''); }}
                style={{ fontWeight: 600 }}
              >
                切換至登入
              </a>
            </span>
          ) : (
            <span>
              尚未擁有帳號？{' '}
              <a
                href="#register"
                onClick={(e) => { e.preventDefault(); setIsRegister(true); setLocalError(''); }}
                style={{ fontWeight: 600 }}
              >
                免費註冊
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
