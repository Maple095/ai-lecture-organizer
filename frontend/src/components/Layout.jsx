import React from 'react';
import Header from './Header';

export default function Layout({ children, user, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header user={user} onLogout={onLogout} />
      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">
          {children}
        </div>
      </main>
      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '1.25rem 0',
        textAlign: 'center',
        fontSize: '0.875rem',
        color: 'var(--text-muted)',
        backgroundColor: 'var(--surface-color)'
      }}>
        <div className="container">
          AI Cloud Lecture Organizer &copy; 2026. Built with React + Vite + Node.js + PostgreSQL.
        </div>
      </footer>
    </div>
  );
}
