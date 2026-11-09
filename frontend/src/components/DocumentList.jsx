import React, { useState, useEffect } from 'react';

export default function DocumentList({ refreshTrigger }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadDocuments() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/documents?page=1&limit=50');
      const json = await res.json();
      if (res.ok && json.success) {
        setDocuments(json.data.items || []);
      } else {
        setError(json.error?.message || '讀取文件列表失敗');
      }
    } catch (err) {
      setError(`連線失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, [refreshTrigger]);

  async function handleDelete(id, filename) {
    if (!window.confirm(`確定要刪除講義「${filename}」嗎？此操作將同時刪除原始檔案與關聯內容。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        setDocuments(prev => prev.filter(doc => doc.id !== id));
      } else {
        alert(json.error?.message || '刪除失敗');
      }
    } catch (err) {
      alert(`刪除時發生錯誤: ${err.message}`);
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'completed':
        return <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>已就緒</span>;
      case 'processing':
        return <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>解析中</span>;
      case 'failed':
        return <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>解析失敗</span>;
      case 'cancelled':
        return <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>已取消</span>;
      default:
        return <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>等待處理 (pending)</span>;
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)' }}>
          📚 我的講義與檔案列表 ({documents.length})
        </h3>
        <button className="secondary" onClick={loadDocuments} style={{ fontSize: '0.8rem' }}>
          重新整理
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          載入檔案中...
        </div>
      ) : documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
          目前尚無任何講義檔案，請使用上方表單上傳。
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>檔案名稱</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>格式</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>大小</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>狀態</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>上傳時間</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(doc => (
                <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>
                    {doc.original_filename}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textTransform: 'uppercase', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {doc.file_extension ? doc.file_extension.replace('.', '') : '-'}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>
                    {(doc.file_size / 1024).toFixed(1)} KB
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {getStatusBadge(doc.status)}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(doc.created_at).toLocaleString('zh-TW', { hour12: false })}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        download
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)',
                          borderRadius: '4px',
                          fontWeight: 500
                        }}
                      >
                        下載
                      </a>
                      <button
                        onClick={() => handleDelete(doc.id, doc.original_filename)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#fef2f2',
                          color: 'var(--danger)',
                          border: 'none',
                          borderRadius: '4px'
                        }}
                      >
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
