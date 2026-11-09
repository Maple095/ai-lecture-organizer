import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

export default function Header() {
  const { user, logout } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <header style={{
        backgroundColor: 'var(--surface-color)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0.75rem 0',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '1.1rem'
            }}>
              AI
            </div>
            <div>
              <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                AI 雲端講義整理與搜尋平台
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Phase 2 MVP System
              </p>
            </div>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--primary)',
                  backgroundColor: 'var(--primary-light)',
                  padding: '0.25rem 0.625rem',
                  borderRadius: '4px'
                }}>
                  👤 {user.displayName || user.email}
                </span>
                <button className="secondary" onClick={logout} style={{ fontSize: '0.8rem' }}>
                  登出
                </button>
              </div>
            ) : (
              <button className="primary" onClick={() => setModalOpen(true)}>
                登入 / 註冊
              </button>
            )}
          </nav>
        </div>
      </header>

      <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
