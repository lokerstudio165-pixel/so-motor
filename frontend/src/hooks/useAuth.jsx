// src/hooks/useAuth.js
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sm_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  async function login(email, senha) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, senha });
      localStorage.setItem('sm_token', data.token);
      localStorage.setItem('sm_user', JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || 'Erro ao conectar' };
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('sm_token');
    localStorage.removeItem('sm_user');
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
