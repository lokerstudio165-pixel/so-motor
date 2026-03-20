// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', senha: '' });
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const res = await login(form.email, form.senha);
    if (res.ok) navigate('/');
    else setError(res.error);
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.badge}>SÓ MOTOR</div>
        <p style={S.sub}>Painel de Gestão · Acesso Restrito</p>

        <form onSubmit={handleSubmit} style={S.form}>
          <div style={S.field}>
            <label style={S.label}>Usuário</label>
            <input
              style={S.input}
              type="text"
              placeholder="seu usuário"
              value={form.email}
              onChange={e => setForm(p => ({...p, email: e.target.value}))}
              required
            />
          </div>
          <div style={S.field}>
            <label style={S.label}>Senha</label>
            <input
              style={S.input}
              type="password"
              placeholder="••••••••"
              value={form.senha}
              onChange={e => setForm(p => ({...p, senha: e.target.value}))}
              required
            />
          </div>
          {error && <div style={S.error}>{error}</div>}
          <button type="submit" style={S.btn} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p style={S.hint}>Usuário: prucci · Senha: 123456789</p>
      </div>
    </div>
  );
}

const S = {
  wrap: { minHeight:'100vh', background:'#0d0d0d', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  card: { background:'#161616', border:'1px solid #222', borderRadius:'12px', padding:'40px', width:'100%', maxWidth:'380px', textAlign:'center' },
  badge: { background:'#C8102E', color:'#fff', fontFamily:'Bebas Neue', fontSize:'28px', letterSpacing:'3px', padding:'6px 20px', borderRadius:'6px', display:'inline-block', marginBottom:'12px' },
  sub: { fontSize:'12px', color:'#666', letterSpacing:'1px', marginBottom:'28px' },
  form: { display:'flex', flexDirection:'column', gap:'14px', textAlign:'left' },
  field: { display:'flex', flexDirection:'column', gap:'5px' },
  label: { fontSize:'11px', color:'#888', textTransform:'uppercase', letterSpacing:'1px' },
  input: { background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:'7px', padding:'10px 14px', color:'#f0f0f0', fontSize:'14px', fontFamily:'DM Sans', outline:'none', transition:'border-color .2s' },
  error: { background:'rgba(200,16,46,.1)', border:'1px solid rgba(200,16,46,.3)', borderRadius:'6px', padding:'10px 14px', color:'#ff6b6b', fontSize:'12px' },
  btn: { background:'#C8102E', color:'#fff', border:'none', borderRadius:'7px', padding:'12px', fontSize:'14px', fontWeight:'600', cursor:'pointer', letterSpacing:'.5px', marginTop:'4px' },
  hint: { fontSize:'11px', color:'#444', marginTop:'16px' },
};
