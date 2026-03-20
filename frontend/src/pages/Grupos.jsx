// src/pages/Grupos.jsx — painel de detalhes profissional
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Loading } from '../components/UI';

const fmt   = (n,d=0) => n==null||isNaN(n)||n===''?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtR  = (n) => { if(n==null||isNaN(n)||n==='') return '—'; const v=Number(n); if(v>=1e6) return 'R$'+fmt(v/1e6,1)+'M'; if(v>=1e3) return 'R$'+fmt(v/1e3,1)+'K'; return 'R$'+fmt(v,0); };
const fmtM  = (n) => n==null||isNaN(n)||n===''?'—':fmt(n,1)+'%';
const COR_M = (m) => Number(m)>=50?'#22c55e':Number(m)>=30?'#f59e0b':'#C8102E';

const CORES_FILIAIS = ['#C8102E','#3b82f6','#22c55e','#f59e0b','#a855f7','#14b8a6',
  '#f97316','#e63950','#60a5fa','#34d399','#fbbf24','#c084fc','#2dd4bf','#fb923c','#818cf8','#4ade80','#facc15','#f472b6'];

// ─── Gráfico de tendência rico com linha + área ───────────────
function TendenciaChart({ data, cor='#C8102E', height=100 }) {
  const [tip, setTip] = useState(null);
  if (!data?.length) return null;
  const vals = data.map(t => Number(t.vendas)||0);
  const max  = Math.max(...vals, 1);
  const min  = 0;
  const W=560, H=height, PAD=20;
  const xs = vals.map((_,i) => PAD + (i/(vals.length-1||1))*(W-PAD*2));
  const ys = vals.map(v => PAD + (1-(v-min)/(max-min||1))*(H-PAD*2));
  const path = xs.map((x,i)=>`${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = `${path} L${xs[xs.length-1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`;
  const gId  = `gtg${cor.replace('#','')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height,overflow:'visible'}}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={cor} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={cor} stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gId})`}/>
      <path d={path}  fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {xs.map((x,i) => {
        const isL = i===vals.length-1;
        return (
          <g key={i} style={{cursor:'pointer'}}
            onMouseEnter={()=>setTip(i)} onMouseLeave={()=>setTip(null)}>
            <circle cx={x} cy={ys[i]} r={14} fill="transparent"/>
            <circle cx={x} cy={ys[i]} r={tip===i?5:isL?4:3} fill={cor} style={{transition:'r .12s'}}/>
            {isL && <circle cx={x} cy={ys[i]} r={9} fill={cor} fillOpacity="0.15"/>}
            <text x={x} y={H-2} textAnchor="middle" fontSize="9" fill="#444">{data[i].mes.split('/')[0]}</text>
            {tip===i && (
              <>
                <line x1={x} y1={ys[i]+6} x2={x} y2={H-14} stroke={cor} strokeWidth="1" strokeDasharray="3,2" strokeOpacity="0.25"/>
                <rect x={x-56} y={ys[i]-28} width={112} height={22} rx={5} fill="#1e1e1e" stroke={cor} strokeWidth="0.8" strokeOpacity="0.5"/>
                <text x={x} y={ys[i]-13} textAnchor="middle" fontSize="10" fill="#fff" fontFamily="monospace" fontWeight="700">
                  {data[i].mes}: {fmtR(vals[i])}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Barra de loja estilo BASTO ───────────────────────────────
function LojaBarBasto({ filial, valor, maxVal, margem, idx, onClickFilial }) {
  const [hov, setHov] = useState(false);
  const pct = maxVal>0 ? (Number(valor||0)/maxVal*100) : 0;
  const cor = CORES_FILIAIS[idx % CORES_FILIAIS.length];
  return (
    <div
      onClick={()=>onClickFilial&&onClickFilial(filial)}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        display:'flex', alignItems:'center', gap:9,
        padding:'5px 8px', borderRadius:6, cursor:'pointer',
        background: hov ? 'rgba(255,255,255,.03)' : 'transparent',
        transition:'background .12s',
        position:'relative',
      }}>
      {/* Tooltip */}
      {hov && (
        <div style={{
          position:'absolute', left:42, top:-28, zIndex:20, pointerEvents:'none',
          background:'#1e1e1e', border:`1px solid ${cor}55`, borderRadius:5,
          padding:'3px 10px', fontSize:9, color:'#fff', whiteSpace:'nowrap',
        }}>
          {filial}: {fmtR(valor)} · margem {fmtM(margem)} · clique p/ filtrar
        </div>
      )}
      {/* Código */}
      <span style={{
        fontSize:12, fontWeight:700, width:34, flexShrink:0,
        color: hov ? '#fff' : '#f59e0b',
        transition:'color .12s',
      }}>{filial}</span>
      {/* Barra */}
      <div style={{flex:1, height:22, background:'#1a1a1a', borderRadius:4, overflow:'hidden', position:'relative'}}>
        <div style={{
          height:'100%', width:`${pct}%`,
          background: hov
            ? `linear-gradient(90deg, ${cor}ee, ${cor}88)`
            : `linear-gradient(90deg, #C8102Ecc, #C8102E66)`,
          borderRadius:4,
          transition:'width .45s ease, background .15s',
          display:'flex', alignItems:'center', paddingLeft:8,
        }}>
          {pct > 20 && (
            <span style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,.9)',whiteSpace:'nowrap'}}>
              {fmtR(valor)}
            </span>
          )}
        </div>
        {pct <= 20 && Number(valor) > 0 && (
          <span style={{
            position:'absolute', left:`calc(${pct}% + 8px)`, top:'50%',
            transform:'translateY(-50%)', fontSize:10, fontWeight:700,
            color: hov ? '#ccc' : '#666',
            whiteSpace:'nowrap', transition:'color .12s',
          }}>{fmtR(valor)}</span>
        )}
      </div>
      {/* Margem */}
      <span style={{
        fontSize:11, fontWeight:700, color:COR_M(margem),
        width:42, textAlign:'right', flexShrink:0, fontFamily:'monospace',
      }}>{fmtM(margem)}</span>
    </div>
  );
}

// ─── Card de grupo na grade ───────────────────────────────────
function GrupoCard({ g, isSel, pctShare, onClick }) {
  const [hov, setHov] = useState(false);
  const corM = COR_M(g.margem_real);
  return (
    <div onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        background: isSel ? 'rgba(200,16,46,.12)' : hov ? '#1c1c1c' : '#161616',
        border:`1px solid ${isSel?'rgba(200,16,46,.5)':hov?'#333':'#1e1e1e'}`,
        borderLeft:`3px solid ${isSel?'#C8102E':hov?'#C8102E88':'#222'}`,
        borderRadius:10, padding:'13px', cursor:'pointer',
        transition:'all .14s',
        transform: hov&&!isSel ? 'translateY(-1px)' : 'none',
        boxShadow: hov ? '0 4px 18px rgba(0,0,0,.35)' : 'none',
      }}>
      <div style={{fontFamily:'Bebas Neue',fontSize:17,letterSpacing:1,marginBottom:7,
        color:isSel?'#fff':'#f0f0f0',lineHeight:1.2}}>{g.grupo}</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:7}}>
        {[
          {l:'Vendas 6m', v:fmtR(g.vendas_6m),    c:'#f0f0f0'},
          {l:'Margem',    v:fmtM(g.margem_real),   c:corM},
          {l:'Estoque',   v:fmtR(g.valor_estoque), c:'#888'},
          {l:'Itens',     v:fmt(g.total_itens),    c:'#555'},
        ].map(m=>(
          <div key={m.l}>
            <div style={{fontSize:8,color:'#444',textTransform:'uppercase',letterSpacing:.8}}>{m.l}</div>
            <div style={{fontSize:11,fontWeight:700,color:m.c,fontFamily:'monospace'}}>{m.v}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:Number(g.criticos)>0?5:0}}>
        <div style={{flex:1,height:3,background:'#1a1a1a',borderRadius:2,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${pctShare}%`,
            background:isSel?'#C8102E':'#333',borderRadius:2,transition:'width .4s'}}/>
        </div>
        <span style={{fontSize:9,color:'#444',fontFamily:'monospace'}}>{pctShare.toFixed(1)}%</span>
      </div>
      {Number(g.criticos)>0&&(
        <div style={{fontSize:9,color:'#C8102E',display:'flex',alignItems:'center',gap:3}}>
          <span>⚠️</span><span>{fmt(g.criticos)} crítico(s)</span>
          {Number(g.excesso)>0&&<span style={{color:'#f59e0b',marginLeft:6}}>📦 {fmt(g.excesso)} excesso</span>}
        </div>
      )}
    </div>
  );
}

// ─── Cabeçalho de coluna ordenável ───────────────────────────
function ColH({ label, k, curr, asc, onSort }) {
  const act = curr===k;
  return (
    <th onClick={()=>onSort(k)} style={{
      background:'#161616', textAlign:'left', padding:'7px 8px',
      color:act?'#C8102E':'#555', fontSize:9, textTransform:'uppercase',
      letterSpacing:.8, borderBottom:'1px solid #1e1e1e',
      cursor:'pointer', userSelect:'none', whiteSpace:'nowrap', transition:'color .12s',
    }}>
      {label} {act?(asc?'↑':'↓'):<span style={{color:'#2a2a2a'}}>↕</span>}
    </th>
  );
}

// ─── Alertas clicáveis do grupo ───────────────────────────────
function AlertasGrupo({ info, grupo, filialSel, navigate }) {
  const [hov, setHov] = useState(null);
  const itens = [
    {l:'ADEQUADO',    v:info.adequado,    c:'#22c55e', s:'ADEQUADO'},
    {l:'BAIXO',       v:info.baixo||0,    c:'#f97316', s:'BAIXO'},
    {l:'CRÍTICO',     v:info.criticos,    c:'#C8102E', s:'CRITICO'},
    {l:'EXCESSO',     v:info.excesso,     c:'#f59e0b', s:'EXCESSO'},
    {l:'S/ ESTOQUE',  v:info.sem_estoque, c:'#6b7280', s:'SEM ESTOQUE'},
    {l:'S/ VENDA',    v:info.sem_venda,   c:'#334155', s:'SEM VENDA'},
  ];
  return (
    <div style={{display:'flex',borderBottom:'1px solid #1a1a1a'}}>
      {itens.map((a,i)=>(
        <div key={a.l}
          onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}
          onClick={()=>Number(a.v)>0&&navigate('/produtos',{state:{grupo,status:a.s,filial:filialSel!=='Todas'?filialSel:''}})}
          style={{
            flex:1, padding:'8px 4px', textAlign:'center',
            borderRight:'1px solid #1a1a1a',
            background: hov===i&&Number(a.v)>0 ? `${a.c}12` : Number(a.v)>0&&(a.s==='CRITICO'||a.s==='SEM ESTOQUE')?`${a.c}07`:'transparent',
            cursor: Number(a.v)>0 ? 'pointer' : 'default',
            transition:'background .14s',
          }}>
          <div style={{
            fontSize:14, fontWeight:800,
            color: Number(a.v)>0 ? a.c : '#252525',
            fontFamily:'monospace',
            transform: hov===i&&Number(a.v)>0 ? 'scale(1.1)' : 'none',
            transition:'transform .12s, color .12s',
          }}>{fmt(a.v)}</div>
          <div style={{fontSize:8,color:'#444',textTransform:'uppercase',letterSpacing:.5,marginTop:1}}>{a.l}</div>
          {hov===i&&Number(a.v)>0&&(
            <div style={{fontSize:7,color:a.c,marginTop:1}}>→ produtos</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
export default function Grupos() {
  const navigate  = useNavigate();
  const searchRef = useRef(null);
  const painelRef = useRef(null);

  const [filialSel,  setFilialSel]  = useState('Todas');
  const [filiais,    setFiliais]    = useState([]);
  const [grupos,     setGrupos]     = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [detalhes,   setDetalhes]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [loadingD,   setLoadingD]   = useState(false);
  const [search,     setSearch]     = useState('');
  const [sortKey,    setSortKey]    = useState('vendas_6m');
  const [sortAsc,    setSortAsc]    = useState(false);
  const [detTab,     setDetTab]     = useState('lojas');
  const [itensSortK, setItensSortK] = useState('vlr_vendido_filial_6m');
  const [itensSortA, setItensSortA] = useState(false);
  // métricas das barras de loja no painel
  const [lojaMetrica, setLojaMetrica] = useState('vendas_6m');

  const LOJA_METRICAS = [
    {key:'vendas_6m',  label:'Vendas 6M', field:'vendas_6m'},
    {key:'valor_estoque', label:'Estoque', field:'valor_estoque'},
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = filialSel!=='Todas' ? {filial:filialSel} : {};
      const [g, fl] = await Promise.all([
        api.get('/kpis/lista-grupos', {params:p}),
        api.get('/kpis/filiais'),
      ]);
      setGrupos(g.data||[]);
      setFiliais(fl.data||[]);
    } catch(e){ console.error(e); }
    finally{ setLoading(false); }
  }, [filialSel]);

  useEffect(()=>{ load(); },[load]);

  async function abrirGrupo(g) {
    if (selected?.grupo===g.grupo) { setSelected(null); setDetalhes(null); return; }
    setSelected(g);
    setDetTab('lojas');
    setLoadingD(true);
    // scroll ao painel
    setTimeout(()=>painelRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),80);
    try {
      const p = {grupo:g.grupo};
      if (filialSel!=='Todas') p.filial = filialSel;
      const {data} = await api.get('/kpis/grupos-detalhes', {params:p});
      setDetalhes(data);
    } catch(e){ console.error(e); }
    finally{ setLoadingD(false); }
  }

  // Keyboard
  useEffect(()=>{
    const fn = e=>{
      if(e.key==='/'&&document.activeElement!==searchRef.current){e.preventDefault();searchRef.current?.focus();}
      if(e.key==='Escape'){setSelected(null);setDetalhes(null);}
    };
    window.addEventListener('keydown',fn);
    return ()=>window.removeEventListener('keydown',fn);
  },[]);

  function handleSort(k){ if(sortKey===k)setSortAsc(a=>!a); else{setSortKey(k);setSortAsc(false);} }
  function handleItensSort(k){ if(itensSortK===k)setItensSortA(a=>!a); else{setItensSortK(k);setItensSortA(false);} }

  const filtered = grupos
    .filter(g=>!search||g.grupo.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{ const va=Number(a[sortKey]||0),vb=Number(b[sortKey]||0); return sortAsc?va-vb:vb-va; });

  const totalVendas = grupos.reduce((a,g)=>a+Number(g.vendas_6m||0),0)||1;
  const empty = grupos.length===0&&!loading;
  const grupoInfo = detalhes?.grupos?.[0];

  const itensSorted = detalhes?.topItens
    ? [...detalhes.topItens].sort((a,b)=>{
        const va=Number(a[itensSortK]||0),vb=Number(b[itensSortK]||0);
        return itensSortA?va-vb:vb-va;
      })
    : [];

  // para o seletor de métricas do painel de lojas
  const lojaMaxVal = detalhes?.porFilial
    ? Math.max(...detalhes.porFilial.map(f=>Number(f[lojaMetrica==='vendas_6m'?'vendas_6m':'valor_estoque']||0)),1)
    : 1;

  return (
    <div style={{padding:'16px 24px',display:'flex',flexDirection:'column',gap:12}}>

      {/* ── Filtros ────────────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',
        background:'#111',border:'1px solid #1a1a1a',borderRadius:9,padding:'9px 14px'}}>
        <span style={{fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:1}}>Loja:</span>
        {['Todas',...filiais.map(f=>f.filial)].map(cod=>(
          <button key={cod} onClick={()=>{setFilialSel(cod);setSelected(null);setDetalhes(null);}}
            style={{background:filialSel===cod?'rgba(200,16,46,.18)':'transparent',
              border:`1px solid ${filialSel===cod?'rgba(200,16,46,.5)':'#222'}`,
              borderRadius:20,padding:'3px 11px',color:filialSel===cod?'#C8102E':'#555',
              fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .13s'}}>
            {cod}
          </button>
        ))}
        <div style={{marginLeft:'auto',display:'flex',gap:4,alignItems:'center'}}>
          {[
            {key:'vendas_6m',label:'Vendas'},
            {key:'valor_estoque',label:'Estoque'},
            {key:'lucro_6m',label:'Lucro'},
            {key:'margem_real',label:'Margem'},
            {key:'total_itens',label:'Itens'},
          ].map(o=>(
            <button key={o.key} onClick={()=>handleSort(o.key)}
              style={{background:sortKey===o.key?'rgba(200,16,46,.15)':'transparent',
                border:`1px solid ${sortKey===o.key?'rgba(200,16,46,.4)':'#222'}`,
                borderRadius:5,padding:'4px 9px',
                color:sortKey===o.key?'#C8102E':'#555',
                fontSize:10,fontWeight:700,cursor:'pointer',transition:'all .13s'}}>
              {o.label} {sortKey===o.key?(sortAsc?'↑':'↓'):''}
            </button>
          ))}
          <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 Buscar grupo... (/)"
            style={{background:'#161616',border:'1px solid #2a2a2a',borderRadius:7,
              padding:'6px 12px',color:'#f0f0f0',fontSize:11,width:185,
              outline:'none',transition:'border .13s'}}
            onFocus={e=>e.target.style.borderColor='#C8102E'}
            onBlur={e=>e.target.style.borderColor='#2a2a2a'}/>
        </div>
      </div>

      {/* ── Sumário ────────────────────────────────────────── */}
      {!loading&&grupos.length>0&&(
        <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
          {[
            {l:'Grupos',       v:grupos.length,                                                         c:'#3b82f6'},
            {l:'Vendas 6m',    v:fmtR(grupos.reduce((a,g)=>a+Number(g.vendas_6m||0),0)),               c:'#22c55e'},
            {l:'Estoque',      v:fmtR(grupos.reduce((a,g)=>a+Number(g.valor_estoque||0),0)),            c:'#f59e0b'},
            {l:'Lucro 6m',     v:fmtR(grupos.reduce((a,g)=>a+Number(g.lucro_6m||0),0)),                c:'#a855f7'},
            {l:'Margem média', v:fmtM(grupos.reduce((a,g)=>a+Number(g.margem_real||0),0)/grupos.length),c:'#14b8a6'},
          ].map(s=>(
            <div key={s.l} style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:8,padding:'7px 13px',display:'flex',flexDirection:'column',gap:2}}>
              <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:.8}}>{s.l}</div>
              <div style={{fontSize:14,fontWeight:700,color:s.c,fontFamily:'monospace'}}>{s.v}</div>
            </div>
          ))}
          {search&&<div style={{fontSize:11,color:'#555',alignSelf:'center',marginLeft:4}}>{filtered.length} resultado(s)</div>}
        </div>
      )}

      {/* ── Conteúdo ───────────────────────────────────────── */}
      {loading ? <Loading/> : empty ? (
        <div style={{background:'rgba(200,16,46,.05)',border:'1px solid rgba(200,16,46,.18)',borderRadius:12,padding:40,textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:12}}>📂</div>
          <div style={{fontFamily:'Bebas Neue',fontSize:22,color:'#f0f0f0',letterSpacing:2,marginBottom:8}}>NENHUM DADO IMPORTADO</div>
          <div style={{fontSize:12,color:'#666'}}>Importe <strong style={{color:'#f39c12'}}>atualizado_sql_todas_as_lojas_csv.csv</strong> em Banco &amp; Planilhas</div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:selected?'360px 1fr':'1fr',gap:14,alignItems:'start'}}>

          {/* ── Grade ──────────────────────────────────────── */}
          <div>
            <div style={{fontSize:10,color:'#444',marginBottom:9}}>
              {filtered.length} grupos · clique para ver detalhes
              {selected&&<span style={{color:'#C8102E',marginLeft:8}}>· {selected.grupo} aberto</span>}
            </div>
            <div style={{display:'grid',gridTemplateColumns:selected?'1fr':'repeat(auto-fill,minmax(178px,1fr))',gap:8}}>
              {filtered.map(g=>(
                <GrupoCard key={g.grupo} g={g}
                  isSel={selected?.grupo===g.grupo}
                  pctShare={Number(g.vendas_6m||0)/totalVendas*100}
                  onClick={()=>abrirGrupo(g)}/>
              ))}
            </div>
          </div>

          {/* ── Painel de detalhes ─────────────────────────── */}
          {selected&&(
            <div ref={painelRef} style={{display:'flex',flexDirection:'column',gap:0,
              background:'#161616',border:'1px solid rgba(200,16,46,.22)',borderRadius:12,overflow:'hidden'}}>

              {/* ── HEADER ─── */}
              <div style={{background:'linear-gradient(135deg,#1a0005 0%,#161616 55%)',padding:'18px 22px',borderBottom:'1px solid #1e1e1e'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
                  <div>
                    <div style={{fontFamily:'Bebas Neue',fontSize:30,letterSpacing:2,color:'#f0f0f0',lineHeight:1}}>{selected.grupo}</div>
                    <div style={{fontSize:11,color:'#555',marginTop:4}}>
                      {fmt(grupoInfo?.total_itens||selected.total_itens)} itens
                      {grupoInfo?.lojas?` · ${fmt(grupoInfo.lojas)} loja(s)`:''}
                      {filialSel!=='Todas'&&<span style={{color:'#C8102E',marginLeft:6}}>· {filialSel}</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <button onClick={()=>navigate('/produtos',{state:{grupo:selected.grupo,filial:filialSel!=='Todas'?filialSel:''}})}
                      style={{background:'rgba(59,130,246,.15)',border:'1px solid rgba(59,130,246,.4)',borderRadius:7,
                        padding:'7px 14px',color:'#3b82f6',cursor:'pointer',fontSize:11,fontWeight:700,
                        display:'flex',alignItems:'center',gap:5}}>
                      📦 Produtos
                    </button>
                    <button onClick={()=>{setSelected(null);setDetalhes(null);}}
                      style={{background:'#1a1a1a',border:'1px solid #2a2a2a',borderRadius:7,
                        padding:'7px 12px',color:'#777',cursor:'pointer',fontSize:13,lineHeight:1}}>
                      ✕
                    </button>
                  </div>
                </div>

                {/* KPIs */}
                {grupoInfo&&(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                    {[
                      {l:'Vendas 6m',  v:fmtR(grupoInfo.vendas_6m),   c:'#22c55e'},
                      {l:'Vendas Mês', v:fmtR(grupoInfo.vendas_mes),  c:'#14b8a6'},
                      {l:'Lucro 6m',   v:fmtR(grupoInfo.lucro_6m),    c:'#a855f7'},
                      {l:'Margem',     v:fmtM(grupoInfo.margem_real), c:COR_M(grupoInfo.margem_real)},
                    ].map(k=>(
                      <div key={k.l} style={{background:'rgba(0,0,0,.3)',borderRadius:8,padding:'10px 12px'}}>
                        <div style={{fontSize:8,color:'#555',textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>{k.l}</div>
                        <div style={{fontFamily:'Bebas Neue',fontSize:20,color:k.c,letterSpacing:1}}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── ALERTAS CLICÁVEIS ─── */}
              {grupoInfo&&(
                <AlertasGrupo
                  info={grupoInfo}
                  grupo={selected.grupo}
                  filialSel={filialSel}
                  navigate={navigate}
                />
              )}

              {/* ── EVOLUÇÃO DE VENDAS ─── */}
              {detalhes?.tendencia&&(
                <div style={{padding:'14px 22px',borderBottom:'1px solid #1a1a1a'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1}}>
                      Evolução de Vendas
                    </span>
                    <span style={{fontSize:9,color:'#333'}}>passe o mouse para ver valor</span>
                  </div>
                  <TendenciaChart data={detalhes.tendencia} cor='#C8102E' height={100}/>
                </div>
              )}

              {/* ── TABS: Por Loja / Top Itens ─── */}
              <div style={{display:'flex',background:'#111',borderBottom:'1px solid #1a1a1a'}}>
                {[
                  {id:'lojas', label:`🏪 Por Loja (${detalhes?.porFilial?.length||0})`},
                  {id:'itens', label:`📦 Top Itens (${detalhes?.topItens?.length||0})`},
                ].map(t=>(
                  <button key={t.id} onClick={()=>setDetTab(t.id)}
                    style={{flex:1,background:'transparent',border:'none',
                      borderBottom:`2px solid ${detTab===t.id?'#C8102E':'transparent'}`,
                      padding:'10px',color:detTab===t.id?'#f0f0f0':'#555',
                      fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .18s'}}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── CONTEÚDO DAS TABS ─── */}
              {loadingD ? (
                <div style={{padding:28}}><Loading/></div>
              ) : detalhes && (
                <>
                  {/* ─── TAB LOJAS ─── */}
                  {detTab==='lojas'&&(
                    <div>
                      {/* Seletor de métrica + cabeçalho */}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                        padding:'10px 18px 6px',borderBottom:'1px solid #1a1a1a'}}>
                        <div style={{display:'flex',gap:4}}>
                          <span style={{fontSize:9,color:'#444',textTransform:'uppercase',letterSpacing:1,alignSelf:'center',marginRight:4}}>
                            Exibir:
                          </span>
                          {LOJA_METRICAS.map(m=>(
                            <button key={m.key} onClick={()=>setLojaMetrica(m.key)}
                              style={{background:lojaMetrica===m.key?'rgba(200,16,46,.15)':'transparent',
                                border:`1px solid ${lojaMetrica===m.key?'rgba(200,16,46,.4)':'#222'}`,
                                borderRadius:5,padding:'3px 9px',
                                color:lojaMetrica===m.key?'#C8102E':'#555',
                                fontSize:10,fontWeight:700,cursor:'pointer',transition:'all .13s'}}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                        <span style={{fontSize:9,color:'#333'}}>Margem →</span>
                      </div>

                      {detalhes.porFilial.length===0 ? (
                        <div style={{textAlign:'center',padding:24,color:'#444',fontSize:12}}>Sem dados por loja</div>
                      ) : (
                        <div style={{padding:'8px 12px 14px',display:'flex',flexDirection:'column',gap:2}}>
                          {detalhes.porFilial.map((f,i)=>(
                            <LojaBarBasto
                              key={f.filial}
                              filial={f.filial}
                              valor={lojaMetrica==='vendas_6m'?f.vendas_6m:f.valor_estoque}
                              maxVal={lojaMaxVal}
                              margem={f.margem}
                              idx={i}
                              onClickFilial={(cod)=>{setFilialSel(cod);setSelected(null);setDetalhes(null);}}
                            />
                          ))}
                          {/* Total */}
                          <div style={{display:'flex',justifyContent:'space-between',
                            marginTop:8,paddingTop:8,borderTop:'1px solid #1a1a1a',padding:'8px 8px 0'}}>
                            <span style={{fontSize:10,color:'#555'}}>Total {detalhes.porFilial.length} lojas</span>
                            <span style={{fontSize:11,color:'#f0f0f0',fontWeight:700,fontFamily:'monospace'}}>
                              {fmtR(detalhes.porFilial.reduce((a,f)=>a+Number(f[lojaMetrica==='vendas_6m'?'vendas_6m':'valor_estoque']||0),0))}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── TAB ITENS ─── */}
                  {detTab==='itens'&&(
                    <div style={{overflowX:'auto',maxHeight:380,overflowY:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                        <thead>
                          <tr>
                            <ColH label="Loja"      k="filial"               curr={itensSortK} asc={itensSortA} onSort={handleItensSort}/>
                            <ColH label="Ref."      k="referencia"           curr={itensSortK} asc={itensSortA} onSort={handleItensSort}/>
                            <ColH label="Descrição" k="descricao"            curr={itensSortK} asc={itensSortA} onSort={handleItensSort}/>
                            <ColH label="Est."      k="saldo_estoque_filial" curr={itensSortK} asc={itensSortA} onSort={handleItensSort}/>
                            <ColH label="Vds 6m"    k="vlr_vendido_filial_6m" curr={itensSortK} asc={itensSortA} onSort={handleItensSort}/>
                            <ColH label="Margem"    k="margem_pct_filial"    curr={itensSortK} asc={itensSortA} onSort={handleItensSort}/>
                          </tr>
                        </thead>
                        <tbody>
                          {itensSorted.map((r,i)=>(
                            <tr key={i}
                              style={{borderBottom:'1px solid #111',cursor:'pointer',transition:'background .08s'}}
                              onClick={()=>navigate('/produtos',{state:{filial:r.filial,grupo:selected?.grupo}})}
                              onMouseEnter={e=>e.currentTarget.style.background='rgba(200,16,46,.06)'}
                              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                              <td style={{padding:'6px 8px',color:'#f59e0b',fontWeight:700}}>{r.filial}</td>
                              <td style={{padding:'6px 8px',fontFamily:'monospace',color:'#555',fontSize:9}}>{r.referencia}</td>
                              <td style={{padding:'6px 8px',color:'#ddd',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.descricao}>{r.descricao}</td>
                              <td style={{padding:'6px 8px',fontFamily:'monospace',color:'#60a5fa',textAlign:'right'}}>{fmt(r.saldo_estoque_filial)}</td>
                              <td style={{padding:'6px 8px',fontFamily:'monospace',fontWeight:700,textAlign:'right'}}>{fmtR(r.vlr_vendido_filial_6m)}</td>
                              <td style={{padding:'6px 8px',fontWeight:700,color:COR_M(r.margem_pct_filial),textAlign:'right'}}>{fmtM(r.margem_pct_filial)}</td>
                            </tr>
                          ))}
                          {itensSorted.length===0&&(
                            <tr><td colSpan={6} style={{textAlign:'center',padding:20,color:'#444',fontSize:12}}>Sem itens com venda</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
