import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 頁面載入時自動確認既有 Session
  useEffect(() => {
    async function checkAuth() {
      try {
        setLoading(true);
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setUser(json.data);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to check auth state:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  // 登入
  async function login(email, password) {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || '登入失敗，請確認帳號密碼');
      }

      setUser(json.data);
      return json.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  // 註冊
  async function register(email, password, displayName) {
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || '註冊失敗');
      }

      setUser(json.data);
      return json.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  // 登出
  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
