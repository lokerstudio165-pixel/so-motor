// src/components/UI.jsx — Componentes reutilizáveis

// ─── CARD ─────────────────────────────────────────────────────
export function Card({ children, style }) {
  return (
    <div style={{ background:'#161616', border:'1px solid #1e1e1e', borderRadius:'10px', padding:'18px 20px', ...style }}>
      {children}
    </div>
  );
}

// ─── CARD TITLE ───────────────────────────────────────────────
export function CardTitle({ children, right }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
      <span style={{ fontSize:'11px', fontWeight:600, textTransform:'uppercase', letterSpacing:'1.5px', color:'#888' }}>
        {children}
      </span>
      {right}
    </div>
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────
export function KpiCard({ icon, label, value, meta, color, prog, delay=0 }) {
  const colors = { red:'#C8102E', green:'#22c55e', teal:'#14b8a6', yellow:'#f59e0b', blue:'#3b82f6', orange:'#f97316' };
  const c = colors[color] || colors.red;
  return (
    <div style={{ background:'#161616', border:'1px solid #1e1e1e', borderRadius:'10px', padding:'14px 16px', position:'relative', overflow:'hidden', cursor:'default', animationDelay:`${delay}s` }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:c }} />
      <div style={{ width:'30px', height:'30px', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', marginBottom:'8px', background:`${c}20` }}>
        {icon}
      </div>
      <div style={{ fontSize:'10px', textTransform:'uppercase', letterSpacing:'1.2px', color:'#666', marginBottom:'4px' }}>{label}</div>
      <div style={{ fontFamily:'Bebas Neue', fontSize:'24px', letterSpacing:'1px', lineHeight:1, marginBottom:'6px' }}>{value}</div>
      <div style={{ fontSize:'10px', color:'#666' }}>{meta}</div>
      {prog !== undefined && (
        <div style={{ height:'3px', background:'#222', borderRadius:'2px', marginTop:'8px', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${prog}%`, background:c, borderRadius:'2px' }} />
        </div>
      )}
    </div>
  );
}

// ─── STATUS BADGE ─────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    'EXCESSO':     { bg:'rgba(59,130,246,.15)',  color:'#3b82f6' },
    'CRITICO':     { bg:'rgba(200,16,46,.2)',    color:'#ff6b6b' },
    'ADEQUADO':    { bg:'rgba(34,197,94,.15)',   color:'#22c55e' },
    'SEM ESTOQUE': { bg:'rgba(245,158,11,.12)',  color:'#f59e0b' },
    'BAIXO':       { bg:'rgba(168,85,247,.12)',  color:'#a855f7' },
    'SEM VENDA':   { bg:'rgba(107,114,128,.15)', color:'#9ca3af' },
  };
  const s = map[status] || { bg:'#222', color:'#888' };
  return (
    <span style={{ padding:'2px 8px', borderRadius:'10px', fontSize:'9px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', background:s.bg, color:s.color }}>
      {status}
    </span>
  );
}

// ─── FILTER BAR ───────────────────────────────────────────────
export function FilterBar({ filters, onChange, search, onSearch, showStatus=true, unidades=[] }) {
  // Monta lista: sempre começa com 'Todas', depois as do banco
  const lista = ['Todas', ...unidades.filter(u => u && u !== 'Todas')];
  return (
    <div style={{ background:'#161616', borderBottom:'1px solid #1a1a1a', padding:'8px 24px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
      <span style={S.flabel}>Unidade:</span>
      {lista.map(u => (
        <button key={u} onClick={() => onChange('unidade', u)} style={{ ...S.chip, ...(filters.unidade===u ? S.chipOn : {}) }}>{u}</button>
      ))}
      {showStatus && <>
        <span style={{...S.flabel, marginLeft:'8px'}}>Status:</span>
        {['CRITICO','EXCESSO','SEM ESTOQUE','ADEQUADO'].map(s => (
          <button key={s} onClick={() => onChange('status', filters.status===s ? null : s)}
            style={{ ...S.chip, ...(filters.status===s ? S.chipOn : {}) }}>
            {s==='CRITICO'?'⚠️ ':''}{s}
          </button>
        ))}
      </>}
      <div style={{ marginLeft:'auto' }}>
        <input
          style={S.search}
          placeholder="🔍 Buscar produto ou grupo..."
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>
    </div>
  );
}

// ─── TABLE ────────────────────────────────────────────────────
export function Pagination({ page, total, limit, onPage }) {
  const start = page * limit + 1;
  const end = Math.min((page+1)*limit, total);
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 2px 0', fontSize:'11px', color:'#666', borderTop:'1px solid #1a1a1a', marginTop:'8px' }}>
      <span>{start}–{end} de {total.toLocaleString('pt-BR')} itens</span>
      <div style={{ display:'flex', gap:'6px' }}>
        <button onClick={() => onPage(page-1)} disabled={page===0} style={S.pgBtn}>← Anterior</button>
        <button onClick={() => onPage(page+1)} disabled={end>=total} style={S.pgBtn}>Próximo →</button>
      </div>
    </div>
  );
}

// ─── LOADING ──────────────────────────────────────────────────
export function Loading() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'120px', color:'#444', fontSize:'13px', gap:'8px' }}>
      <div style={{ width:'16px', height:'16px', border:'2px solid #333', borderTopColor:'#C8102E', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
      Carregando...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── DONUT CHART ──────────────────────────────────────────────
export function DonutChart({ data, colors, centerLabel, centerSub }) {
  const total = data.reduce((a,d) => a+Number(d.value),0);
  const r=45, cx=65, cy=65, circ=2*Math.PI*r;
  let offset=0;
  const slices = data.map((d,i) => {
    const pct = Number(d.value)/total;
    const dash = pct*circ;
    const el = { d, i, dash, offset, color: colors[i % colors.length] };
    offset += dash;
    return el;
  });
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'12px' }}>
      <svg viewBox="0 0 130 130" style={{ width:'120px', height:'120px' }}>
        {slices.map(({d,i,dash,offset:off,color}) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={16}
            strokeDasharray={`${dash.toFixed(2)} ${(circ-dash).toFixed(2)}`}
            strokeDashoffset={(-off).toFixed(2)}
            transform={`rotate(-90 ${cx} ${cy})`} opacity={.9}
          />
        ))}
        {centerLabel && <text x={cx} y={cy-5} textAnchor="middle" fill="#f0f0f0" fontSize="12" fontWeight="700" fontFamily="Bebas Neue">{centerLabel}</text>}
        {centerSub   && <text x={cx} y={cy+10} textAnchor="middle" fill="#555" fontSize="9" fontFamily="DM Sans">{centerSub}</text>}
      </svg>
      <div style={{ width:'100%' }}>
        {slices.map(({d,color}) => (
          <div key={d.name} style={{ display:'flex', alignItems:'center', gap:'7px', fontSize:'11px', color:'#888', padding:'3px 6px', borderRadius:'4px' }}>
            <div style={{ width:'9px', height:'9px', borderRadius:'2px', background:color, flexShrink:0 }} />
            <span>{d.name}</span>
            <span style={{ marginLeft:'auto', fontWeight:700, color:'#f0f0f0', fontSize:'11px' }}>{Number(d.value).toLocaleString('pt-BR')}</span>
            <span style={{ color:'#555', fontSize:'10px' }}>{(Number(d.value)/total*100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const S = {
  flabel: { fontSize:'10px', color:'#666', textTransform:'uppercase', letterSpacing:'1px', whiteSpace:'nowrap' },
  chip: { background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:'20px', padding:'4px 12px', fontSize:'11px', color:'#f0f0f0', cursor:'pointer', transition:'all .15s', fontFamily:'DM Sans', whiteSpace:'nowrap' },
  chipOn: { background:'#C8102E', borderColor:'#C8102E', color:'#fff' },
  search: { background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:'6px', padding:'5px 12px', fontSize:'12px', color:'#f0f0f0', fontFamily:'DM Sans', outline:'none', width:'220px' },
  pgBtn: { background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:'5px', padding:'4px 10px', color:'#f0f0f0', cursor:'pointer', fontSize:'11px', fontFamily:'DM Sans' },
};
