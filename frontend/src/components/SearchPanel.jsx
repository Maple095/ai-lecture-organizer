import React, { useState } from 'react';

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('or');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const url = `/api/search?q=${encodeURIComponent(query.trim())}&mode=${mode}&limit=20`;
      const res = await fetch(url);
      const json = await res.json();

      if (res.ok && json.success) {
        setResults(json.data.items || []);
        setSearched(true);
      } else {
        setError(json.error?.message || '搜尋發生錯誤');
      }
    } catch (err) {
      setError(`連線失敗: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function formatLocation(loc) {
    if (!loc) return '未知位置';
    switch (loc.type) {
      case 'pdf':
        return `📄 第 ${loc.pageNumber} 頁`;
      case 'docx':
        return `📝 ${loc.headingPath || `段落 ${loc.paragraphIndex + 1}`}`;
      case 'xlsx':
        return `📊 【${loc.sheetName}】第 ${loc.rowIndex} 列 (${loc.cellRange})`;
      case 'csv':
        return `📑 第 ${loc.rowIndex} 列`;
      case 'pptx':
        return `🖥️ 投影片 ${loc.slideNumber}：${loc.slideTitle || ''}`;
      case 'md':
        return `🔖 ${loc.headingPath} (行 ${loc.startLine}~${loc.endLine})`;
      case 'txt':
        return `📃 第 ${loc.startLine}~${loc.endLine} 行`;
      default:
        return '內文段落';
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.75rem' }}>
        🔍 講義全文檢索 (PostgreSQL FTS + 中文 2-gram)
      </h3>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="輸入關鍵字 (如：正規化、PostgreSQL、演算法)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: '1 1 280px',
            padding: '0.625rem 0.875rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-color)',
            fontSize: '0.875rem',
            outline: 'none'
          }}
        />

        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          style={{
            padding: '0.625rem 0.75rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-color)',
            fontSize: '0.875rem',
            backgroundColor: 'var(--surface-color)',
            cursor: 'pointer'
          }}
        >
          <option value="or">OR 相關度 (推薦)</option>
          <option value="and">AND 精確包含</option>
          <option value="phrase">Phrase 完整詞組</option>
        </select>

        <button type="submit" className="primary" disabled={loading || !query.trim()}>
          {loading ? '檢索中...' : '立即搜尋'}
        </button>
      </form>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
          正在比對全站講義與 GIN 索引...
        </div>
      )}

      {!loading && searched && (
        <div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            找到 {results.length} 筆符合「<strong>{query}</strong>」的講義段落：
          </div>

          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              查無符合條件的講義內容。若剛上傳檔案，請稍候片刻等待後台解析完成。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {results.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '0.875rem 1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                        {item.original_filename}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        {formatLocation(item.source_location)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        相關度: {parseFloat(item.rank).toFixed(3)}
                      </span>
                      <a
                        href={`/api/documents/${item.document_id}/download`}
                        download
                        style={{ fontSize: '0.75rem', fontWeight: 500 }}
                      >
                        下載原檔
                      </a>
                    </div>
                  </div>

                  <p style={{
                    fontSize: '0.85rem',
                    color: '#334155',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    backgroundColor: 'white',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid #edf2f7'
                  }}>
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
