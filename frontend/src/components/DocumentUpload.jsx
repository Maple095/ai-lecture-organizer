import React, { useState, useRef } from 'react';

export default function DocumentUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  const allowedFormats = ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.md', '.csv', '.png', '.jpg'];

  function handleFileChange(e) {
    setError(null);
    setSuccessMsg('');
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 20 * 1024 * 1024) {
        setError('檔案大小不得超過 20 MB');
        return;
      }
      setFile(selected);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setError('請先選取講義檔案');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccessMsg('');

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || '上傳失敗');
      }

      setSuccessMsg(`「${file.name}」上傳成功，已持久化保存！`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onUploadSuccess) onUploadSuccess(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem' }}>
        📤 上傳講義或教材文件
      </h3>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        支援格式：PDF、Word (.docx)、Excel (.xlsx)、PPT (.pptx)、CSV、TXT、Markdown、圖片 (單檔上限 20MB)
      </p>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: 'var(--danger)',
          padding: '0.625rem 0.75rem',
          borderRadius: 'var(--radius)',
          fontSize: '0.875rem',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: 'var(--success)',
          padding: '0.625rem 0.75rem',
          borderRadius: 'var(--radius)',
          fontSize: '0.875rem',
          marginBottom: '1rem'
        }}>
          {successMsg}
        </div>
      )}

      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{
          border: '2px dashed var(--border-color)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          textAlign: 'center',
          backgroundColor: '#fafafa',
          cursor: 'pointer'
        }}
        onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={allowedFormats.join(',')}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📁</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-main)' }}>
            {file ? file.name : '點擊選取或拖曳檔案至此'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {file ? `(${(file.size / 1024).toFixed(1)} KB)` : '支援多格式自動分析'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          {file && (
            <button
              type="button"
              className="secondary"
              onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              disabled={uploading}
            >
              取消
            </button>
          )}
          <button
            type="submit"
            className="primary"
            disabled={!file || uploading}
          >
            {uploading ? '上傳儲存中...' : '開始上傳保存'}
          </button>
        </div>
      </form>
    </div>
  );
}
