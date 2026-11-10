import React, { useState, useRef, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

export default function AiChatPanel() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 自訂 AI API Key 與端點設定 (記憶體 / SessionStorage 暫存，不存入資料庫)
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('custom_ai_api_key') || '');
  const [apiBaseUrl, setApiBaseUrl] = useState(() => sessionStorage.getItem('custom_ai_base_url') || '');
  const [modelName, setModelName] = useState(() => sessionStorage.getItem('custom_ai_model') || 'gpt-4o-mini');

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '您好！我是您的講義 AI 助理。您可以向我詢問任何已上傳講義的相關問題，我會為您檢索講義內容並標註來源依據。若雲端環境尚未設定全域 API Key，可點擊右上角「⚙️ AI 設定」輸入個人金鑰。',
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

  function updateSetting(key, val) {
    if (key === 'apiKey') {
      setApiKey(val);
      sessionStorage.setItem('custom_ai_api_key', val);
    } else if (key === 'apiBaseUrl') {
      setApiBaseUrl(val);
      sessionStorage.setItem('custom_ai_base_url', val);
    } else if (key === 'modelName') {
      setModelName(val);
      sessionStorage.setItem('custom_ai_model', val);
    }
  }

  function handleClearSettings() {
    setApiKey('');
    setApiBaseUrl('');
    setModelName('gpt-4o-mini');
    sessionStorage.removeItem('custom_ai_api_key');
    sessionStorage.removeItem('custom_ai_base_url');
    sessionStorage.removeItem('custom_ai_model');
  }

  function applyPreset(provider) {
    if (provider === 'gemini') {
      updateSetting('apiBaseUrl', 'https://generativelanguage.googleapis.com/v1beta/openai/');
      updateSetting('modelName', 'gemini-1.5-flash');
    } else if (provider === 'openai') {
      updateSetting('apiBaseUrl', 'https://api.openai.com/v1');
      updateSetting('modelName', 'gpt-4o-mini');
    } else if (provider === 'deepseek') {
      updateSetting('apiBaseUrl', 'https://api.deepseek.com/v1');
      updateSetting('modelName', 'deepseek-chat');
    }
  }

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
      const payload = {
        question: textToSend.trim(),
      };

      // 若使用者有填入自訂金鑰或端點，隨請求一併傳遞 (優先採用)
      if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
        if (apiBaseUrl.trim()) payload.baseUrl = apiBaseUrl.trim();
        if (modelName.trim()) payload.model = modelName.trim();
      }

      const res = await fetch('/api/chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
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
    <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', height: '660px' }}>
      {/* 標題與操作欄 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🤖</span> AI 智慧講義問答 (RAG)
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            基於已上傳講義之向量全文檢索，回答皆標註檔案來源與精確頁碼 / 段落
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="secondary"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() => setShowSettings(!showSettings)}
          >
            <span>⚙️</span> AI 設定
            <span style={{
              fontSize: '0.65rem',
              padding: '0.1rem 0.35rem',
              borderRadius: '4px',
              backgroundColor: apiKey.trim() ? '#dcfce7' : '#f1f5f9',
              color: apiKey.trim() ? '#15803d' : '#64748b',
              fontWeight: 600,
            }}>
              {apiKey.trim() ? '自訂金鑰' : '預設環境'}
            </span>
          </button>
          <button
            type="button"
            className="secondary"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            onClick={() => setMessages([messages[0]])}
          >
            清空對話
          </button>
        </div>
      </div>

      {/* 可折疊 AI 設定面板 */}
      {showSettings && (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)',
          padding: '0.85rem 1rem',
          marginBottom: '0.75rem',
          fontSize: '0.85rem',
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>🔑</span> 自訂 AI API Key (瀏覽器 Session 記憶體暫存，不寫入資料庫)
            </span>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}
              onClick={handleClearSettings}
            >
              清除重設
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                API Key (金鑰)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => updateSetting('apiKey', e.target.value)}
                placeholder="sk-proj-... (未填則回退環境變數)"
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                API Base URL (端點)
              </label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => updateSetting('apiBaseUrl', e.target.value)}
                placeholder="https://api.openai.com/v1"
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                Model (模型名稱)
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => updateSetting('modelName', e.target.value)}
                placeholder="gpt-4o-mini"
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>常用服務範本：</span>
            <button
              type="button"
              onClick={() => applyPreset('gemini')}
              style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                backgroundColor: apiBaseUrl.includes('generativelanguage.googleapis.com') ? '#dcfce7' : '#ffffff',
                color: apiBaseUrl.includes('generativelanguage.googleapis.com') ? '#15803d' : 'var(--text-main)',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              🟢 Google Gemini (1.5 Flash)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('openai')}
              style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                backgroundColor: (apiBaseUrl === 'https://api.openai.com/v1' || !apiBaseUrl) ? '#e0f2fe' : '#ffffff',
                color: (apiBaseUrl === 'https://api.openai.com/v1' || !apiBaseUrl) ? '#0369a1' : 'var(--text-main)',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              🔵 OpenAI (gpt-4o-mini)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('deepseek')}
              style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                backgroundColor: apiBaseUrl.includes('deepseek.com') ? '#f3e8ff' : '#ffffff',
                color: apiBaseUrl.includes('deepseek.com') ? '#7e22ce' : 'var(--text-main)',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              🟣 DeepSeek (deepseek-chat)
            </button>
          </div>
        </div>
      )}

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
                  {isUser ? '您' : `AI 助理 ${msg.model ? `(${msg.model})` : ''}`}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{msg.timestamp}</span>
              </div>

              {/* 對話氣泡 */}
              <div
                style={{
                  maxWidth: '92%',
                  padding: '0.75rem 1.15rem',
                  borderRadius: '12px',
                  backgroundColor: isUser ? 'var(--primary)' : 'var(--primary-light)',
                  color: isUser ? '#ffffff' : 'var(--text-main)',
                  border: isUser ? 'none' : '1px solid #bfdbfe',
                  lineHeight: '1.6',
                  fontSize: '0.9rem',
                }}
              >
                {isUser ? (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}
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
