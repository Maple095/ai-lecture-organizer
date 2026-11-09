import React from 'react';

export default function Header({ user, onLogout }) {
  return (
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
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {user.displayName || user.email}
              </span>
              <button className="secondary" onClick={onLogout}>
                登出
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontSize: '0.75rem',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontWeight: 600
              }}>
                系統就緒
              </span>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
