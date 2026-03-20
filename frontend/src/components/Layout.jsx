// src/components/Layout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div style={{ minHeight:'100vh', background:'#0d0d0d' }}>
      {/* HEADER */}
      <div style={S.hdr}>
        <div style={S.logo}>
          <div style={S.badge}>SÓ MOTOR</div>
          <div>
            <div style={{fontSize:'13px',fontWeight:600}}>Painel de Gestão</div>
            <div style={{fontSize:'10px',color:'#666',textTransform:'uppercase',letterSpacing:'1px'}}>Autopeças · Dashboard Executivo</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'11px',color:'#666'}}>
            <div style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',animation:'blink 2s infinite'}}/>
            {user?.nome}
          </div>
          <button onClick={handleLogout} style={S.logoutBtn}>Sair</button>
        </div>
      </div>

      {/* NAV */}
      <div style={S.nav}>
        {[
          {to:'/',        label:'📊 Visão Geral', end:true},
          {to:'/produtos',label:'📦 Produtos'},
          {to:'/grupos',  label:'🏷️ Grupos'},
          {to:'/cobertura',label:'🔄 Cobertura'},
          {to:'/database',label:'🗄️ Banco & Planilhas'},
          {to:'/mapa-clientes',  label:'👥 Mapa dos Clientes'},
          {to:'/mapa-lojas',     label:'🗺️ Mapa das Lojas'},
          {to:'/estoque-matriz', label:'🏭 Estoque Matriz'},
        ].map(({to,label,end}) => (
          <NavLink key={to} to={to} end={end} style={({isActive}) => ({
            ...S.tab, ...(isActive ? S.tabActive : {})
          })}>{label}</NavLink>
        ))}
      </div>

      <Outlet />

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
        a{text-decoration:none}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#161616}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
        input:focus{border-color:#C8102E !important;outline:none}
      `}</style>
    </div>
  );
}

const S = {
  hdr: { background:'linear-gradient(135deg,#0a0a0a,#1a0005 50%,#0a0a0a)', borderBottom:'1px solid #1e1e1e', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:'52px', position:'sticky', top:0, zIndex:200 },
  logo: { display:'flex', alignItems:'center', gap:'10px' },
  badge: { background:'#C8102E', color:'#fff', fontFamily:'Bebas Neue', fontSize:'20px', letterSpacing:'2px', padding:'3px 12px', borderRadius:'4px' },
  nav: { background:'#161616', borderBottom:'1px solid #1a1a1a', padding:'0 24px', display:'flex', gap:0 },
  tab: { padding:'11px 18px', fontSize:'12px', fontWeight:600, letterSpacing:'.5px', color:'#666', borderBottom:'2px solid transparent', transition:'all .2s', cursor:'pointer' },
  tabActive: { color:'#C8102E', borderBottomColor:'#C8102E' },
  logoutBtn: { background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:'6px', padding:'5px 12px', color:'#888', fontSize:'11px', cursor:'pointer', fontFamily:'DM Sans' },
};