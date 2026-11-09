import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import DocumentUpload from './components/DocumentUpload';
import DocumentList from './components/DocumentList';
import SearchPanel from './components/SearchPanel';

function MainDashboard() {
  const { user } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleUploadSuccess() {
    setRefreshTrigger(prev => prev + 1);
  }

  return (
    <Layout>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* 使用者身分卡片 */}
        <div className="card" style={{
          marginBottom: '1.5rem',
          borderLeft: user ? '4px solid var(--success)' : '4px solid var(--primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              {user ? `您好，${user.displayName}！` : '歡迎使用 AI 雲端講義整理與搜尋平台'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {user
                ? `已驗證登入：${user.email}`
                : '請先登入或註冊，以管理您的個人講義並享有 AI 智慧問答。'}
            </p>
          </div>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.35rem 0.65rem',
            borderRadius: '9999px',
            backgroundColor: user ? '#dcfce7' : '#f1f5f9',
            color: user ? '#15803d' : '#475569'
          }}>
            {user ? '● 已登入' : '○ 訪客'}
          </span>
        </div>

        {user ? (
          <>
            {/* 全文檢索組件 */}
            <SearchPanel />

            {/* 上傳組件 */}
            <DocumentUpload onUploadSuccess={handleUploadSuccess} />

            {/* 文件清單組件 */}
            <DocumentList refreshTrigger={refreshTrigger} />
          </>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔐</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              請登入以開啟個人知識管理
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
              平台提供原始檔案持久化安全儲存、全文檢索以及基於講義內容的精確 AI 知識問答。
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainDashboard />
    </AuthProvider>
  );
}
