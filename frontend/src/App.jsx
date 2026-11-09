import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';

export default function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        setLoading(true);
        const res = await fetch('/api/health');
        const json = await res.json();
        if (json.success) {
          setHealthStatus(json.data);
        } else {
          setError(json.error?.message || '健康檢查回應失敗');
        }
      } catch (err) {
        setError(`無法連線至後端伺服器 (${err.message})`);
      } finally {
        setLoading(false);
      }
    }

    checkHealth();
  }, []);

  return (
    <Layout>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>
            Phase 2：MVP 系統基礎環境就緒
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            已完成 React 前端、Node.js Express 後端、PostgreSQL 原生連線池與 API 代理配置。
          </p>

          <div style={{
            padding: '1rem',
            borderRadius: 'var(--radius)',
            backgroundColor: loading ? '#f1f5f9' : error ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${loading ? '#cbd5e1' : error ? '#fecaca' : '#bbf7d0'}`,
            marginBottom: '1rem'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: loading ? '#475569' : error ? 'var(--danger)' : 'var(--success)',
              marginBottom: '0.25rem'
            }}>
              {loading ? '正在檢測後端服務狀態...' : error ? '後端連線異常' : '後端 API 與資料庫健康檢查通過'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#475569' }}>
              {loading
                ? '發送 GET /api/health 請求中...'
                : error
                ? error
                : `環境: ${healthStatus?.environment} | 運行時間: ${Math.round(healthStatus?.uptime)}s | 資料庫: ${healthStatus?.database?.status}`}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>前端技術棧</div>
              <div style={{ fontWeight: 600 }}>React 18 + Vite (Vanilla CSS)</div>
            </div>
            <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>後端技術棧</div>
              <div style={{ fontWeight: 600 }}>Node.js + Express (ES Modules)</div>
            </div>
            <div style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>資料庫存取</div>
              <div style={{ fontWeight: 600 }}>PostgreSQL 15+ (pg Pool 無 ORM)</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 600 }}>
            MVP 實作進度路線圖
          </h3>
          <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: '1.8' }}>
            <li><strong>Step 1</strong>：專案基礎環境與目錄結構建立【當前步驟】</li>
            <li><strong>Step 2</strong>：使用者帳號、身分驗證與 Session 隔離【即將進入】</li>
            <li><strong>Step 3</strong>：多格式檔案管理、持久化儲存與下載</li>
            <li><strong>Step 4</strong>：多格式 Parser Adapter (PDF, Word, Excel, PPT, CSV, TXT/MD)</li>
            <li><strong>Step 5</strong>：文件分塊 (Chunking) 與 Source Location 保留</li>
            <li><strong>Step 6</strong>：PostgreSQL Full-Text Search (中文 2-gram)</li>
            <li><strong>Step 7</strong>：AI 問答與 RAG 來源依據整合</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
