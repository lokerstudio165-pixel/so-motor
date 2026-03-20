// src/api.js — Cliente HTTP centralizado
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 15000,
});

// Injeta token automaticamente
api.interceptors.request.use(config => {
  const token = localStorage.getItem('sm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redireciona para login se token expirar
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sm_token');
      localStorage.removeItem('sm_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
