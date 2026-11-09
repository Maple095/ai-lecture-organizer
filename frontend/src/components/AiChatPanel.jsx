import React, { useState, useRef, useEffect } from 'react';

export default function AiChatPanel() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '您好！我是您的講義 AI 助理。您可以向我詢問任何已上傳講義的相關問題，我會為您檢索講義內容並標註來源依據。',
      citations: [],
      hasSufficientContext: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [expandedCitation, setExpandedCitation] = useState(null);

  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(customText) {
    const textToSend = customText || question;
    if (!textToSend.trim() || loading) return;

    setError(null);
    const userMessage = {
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question: textToSend.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || '提問失敗，請稍後重試');
      }

      const assistantMessage = {
        role: 'assistant',
        content: data.data.answer,
        citations: data.data.citations || [],
        hasSufficientContext: data.data.hasSufficientContext,
        model: data.data.model,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError(err.message);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ 回應失敗：${err.message}`,
          citations: [],
          hasSufficientContext: false,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatLocation(loc) {
    if (!loc) return '';
    if (loc.type === 'pdf' && loc.pageNumber) return `第 ${loc.pageNumber} 頁`;
    if (loc.type === 'xlsx' && loc.sheetName) {
      return `${loc.sheetName} (第 ${loc.rowIndex || 1} 列)`;
    }
    if (loc.type === 'docx' && loc.paragraphIndex) return `第 ${loc.paragraphIndex} 段`;
    if (loc.type === 'pptx' && loc.slideNumber) return `第 ${loc.slideNumber} 頁簡報`;
    if (loc.type === 'csv' && loc.rowIndex) return `第 ${loc.rowIndex} 行`;
    if (loc.lineStart) return `行 ${loc.lineStart}`;
    return '本文';
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', height: '620px' }}>
      {/* 標題欄 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🤖</span> AI 智慧講義問答 (RAG)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            基於已上傳講義之向量全文檢索，回答皆標註檔案來源與精確頁碼 / 段落
          </p>
        </div>
        <button
          className="secondary"
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
          onClick={() => setMessages([messages[0]])}
        >
          清空對話
        </button>
      </div>

      {/* 訊息展示區域 */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isUser ? 'var(--primary)' : 'var(--text-muted)' }}>
                  {isUser ? '您' : 'AI 助理'}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{msg.timestamp}</span>
              </div>

              {/* 對話氣泡 */}
              <div
                style={{
                  maxWidth: '85%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  backgroundColor: isUser ? 'var(--primary)' : 'var(--primary-light)',
                  color: isUser ? '#ffffff' : 'var(--text-main)',
                  border: isUser ? 'none' : '1px solid #bfdbfe',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.6',
                  fontSize: '0.9rem',
                }}
              >
                {msg.content}
              </div>

              {/* 參考資料不足警告提示 */}
              {!isUser && msg.hasSufficientContext === false && !msg.isError && (
                <div style={{
                  marginTop: '0.4rem',
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}>
                  <span>⚠️</span> 講義中無完全匹配內容，此回答已如實提醒，未憑空臆造
                </div>
              )}

              {/* 來源引用標籤與展開清單 */}
              {!isUser && msg.citations && msg.citations.length > 0 && (
                <div style={{ marginTop: '0.5rem', width: '100%', maxWidth: '85%' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    📎 參考來源 ({msg.citations.length} 處)：
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {msg.citations.map((c, cIdx) => {
                      const isExpanded = expandedCitation === `${index}-${cIdx}`;
                      return (
                        <div key={cIdx} style={{ width: '100%' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedCitation(isExpanded ? null : `${index}-${cIdx}`)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: 'var(--text-main)',
                              textAlign: 'left'
                            }}
                          >
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>[{c.citationIndex}]</span>
                            <span style={{ fontWeight: 600 }}>{c.filename}</span>
                            {c.sourceLocation && (
                              <span style={{ color: '#0284c7', backgroundColor: '#e0f2fe', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem' }}>
                                {formatLocation(c.sourceLocation)}
                              </span>
                            )}
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{isExpanded ? '▲ 收合' : '▼ 查看摘要'}</span>
                          </button>

                          {isExpanded && (
                            <div style={{
                              marginTop: '0.25rem',
                              padding: '0.5rem 0.75rem',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              color: '#334155',
                              lineHeight: '1.4',
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: '0.2rem', color: '#64748b' }}>原文片段：</div>
                              {c.snippet}...
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
            <span>正在檢索講義知識庫並由 AI 組織回答...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* 快捷問題推薦 */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', marginBottom: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {['這份講義的重點概念是什麼？', '請幫我列出考試可能出現的核心名詞定義', '什麼是資料庫正規化？'].map((prompt, pIdx) => (
          <button
            key={pIdx}
            className="secondary"
            style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
            onClick={() => handleSend(prompt)}
            disabled={loading}
          >
            💡 {prompt}
          </button>
        ))}
      </div>

      {/* 輸入區 */}
      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="請輸入欲查詢或提問的內容 (按 Enter 發送)..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-color)',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        />
        <button
          className="primary"
          onClick={() => handleSend()}
          disabled={loading || !question.trim()}
          style={{ padding: '0 1.25rem', whiteSpace: 'nowrap' }}
        >
          {loading ? '思考中...' : '發送提問'}
        </button>
      </div>
    </div>
  );
}
