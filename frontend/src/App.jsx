import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import DocumentUpload from './components/DocumentUpload';
import DocumentList from './components/DocumentList';
import SearchPanel from './components/SearchPanel';
import AiChatPanel from './components/AiChatPanel';

function MainDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('documents'); // 'documents' | 'search' | 'chat'
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleUploadSuccess() {
    setRefreshTrigger(prev => prev + 1);
  }

  return (
    <Layout>
      <div style={{ maxWidth: '950px', margin: '0 auto' }}>
        {/* 使用者身分橫幅卡片 */}
        <div className="card" style={{
          marginBottom: '1.25rem',
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
                ? `已登入：${user.email} (多租戶資料隔離已啟用)`
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
            {user ? '● 已連線' : '○ 訪客模式'}
          </span>
        </div>

        {user ? (
          <>
            {/* 功能分頁導覽列 (Tabs) */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              borderBottom: '2px solid var(--border-color)',
              paddingBottom: '0.25rem'
            }}>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'documents' ? '3px solid var(--primary)' : '3px solid transparent',
                  borderRadius: 0,
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.95rem',
                  fontWeight: activeTab === 'documents' ? 700 : 500,
                  color: activeTab === 'documents' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>📚</span> 講義管理與上傳
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('search')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'search' ? '3px solid var(--primary)' : '3px solid transparent',
                  borderRadius: 0,
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.95rem',
                  fontWeight: activeTab === 'search' ? 700 : 500,
                  color: activeTab === 'search' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🔍</span> 講義全文檢索 (2-gram)
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === 'chat' ? '3px solid var(--primary)' : '3px solid transparent',
                  borderRadius: 0,
                  padding: '0.6rem 1.2rem',
                  fontSize: '0.95rem',
                  fontWeight: activeTab === 'chat' ? 700 : 500,
                  color: activeTab === 'chat' ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>🤖</span> AI 智慧問答 (RAG)
              </button>
            </div>

            {/* 分頁內容 */}
            {activeTab === 'documents' && (
              <div>
                <DocumentUpload onUploadSuccess={handleUploadSuccess} />
                <DocumentList refreshTrigger={refreshTrigger} />
              </div>
            )}

            {activeTab === 'search' && (
              <div>
                <SearchPanel />
              </div>
            )}

            {activeTab === 'chat' && (
              <div>
                <AiChatPanel />
              </div>
            )}
          </>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              請登入以開啟個人知識管理
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 1.5rem auto' }}>
              平台提供原始檔案持久化安全儲存、多格式解析、中文 2-gram 全文檢索，以及具備講義來源佐證的 AI 知識問答。
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
