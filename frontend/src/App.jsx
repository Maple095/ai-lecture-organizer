import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

function MainDashboard() {
  const { user } = useAuth();
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      try {
        setHealthLoading(true);
        const res = await fetch('/api/health');
        const json = await res.json();
        if (json.success) {
          setHealthStatus(json.data);
        }
      } catch (err) {
        console.error('Health check failed:', err);
      } finally {
        setHealthLoading(false);
      }
    }
    checkHealth();
  }, []);

  return (
    <Layout>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        {/* 使用者狀態橫幅 */}
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: user ? '4px solid var(--success)' : '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                {user ? `歡迎回來，${user.displayName}！` : '歡迎使用 AI 雲端講義整理與搜尋平台'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {user
                  ? `目前帳號：${user.email} | 使用者 UUID: ${user.id}`
                  : '您目前為訪客身分，請點擊右上角「登入 / 註冊」以存取您的個人知識庫。'}
              </p>
            </div>
            <div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.35rem 0.65rem',
                borderRadius: '9999px',
                backgroundColor: user ? '#dcfce7' : '#f1f5f9',
                color: user ? '#15803d' : '#475569'
              }}>
                {user ? '● 已驗證使用者' : '○ 訪客未登入'}
              </span>
            </div>
          </div>
        </div>

        {/* 系統狀態與 Step 2 驗收指標 */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--primary)' }}>
            Step 2：使用者帳號與權限隔離（已實作完成）
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>密碼安全機制</div>
              <div style={{ fontWeight: 600, color: 'var(--success)' }}>✓ bcrypt 10 輪安全雜湊</div>
            </div>
            <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Session 狀態管理</div>
              <div style={{ fontWeight: 600, color: 'var(--success)' }}>✓ HTTP-only 簽署 Cookie</div>
            </div>
            <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>多租戶隔離防禦</div>
              <div style={{ fontWeight: 600, color: 'var(--success)' }}>✓ requireAuth 伺服器校驗</div>
            </div>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <strong>多租戶隔離原則</strong>：所有後續文件、Chunk 與搜尋 API，一律強制從伺服器端 Session (<code>req.user.id</code>) 取得目前使用者身分，<strong>絕不信任前端傳入之 <code>user_id</code> 參數</strong>，杜絕跨租戶越權（IDOR）攻擊漏洞。
          </p>
        </div>

        {/* 系統路線圖 */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 600 }}>
            MVP 實作進度
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✔</span> <strong>Step 1</strong>：專案基礎環境與目錄結構建立 (PASSED)
            </div>
            <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✔</span> <strong>Step 2</strong>：使用者帳號、身分驗證與 Session 隔離 (PASSED)
            </div>
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>○</span> <strong>Step 3</strong>：多格式檔案管理、持久化儲存與下載【下一步】
            </div>
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>○</span> <strong>Step 4</strong>：多格式 Parser Adapter (PDF, Word, Excel, PPT, CSV, TXT/MD)
            </div>
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>○</span> <strong>Step 5</strong>：文件分塊 (Chunking) 與 Source Location 保留
            </div>
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>○</span> <strong>Step 6</strong>：PostgreSQL Full-Text Search (中文 2-gram)
            </div>
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>○</span> <strong>Step 7</strong>：AI 問答與 RAG 來源依據整合
            </div>
          </div>
        </div>
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
