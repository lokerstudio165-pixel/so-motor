// src/pages/Cobertura.jsx — tabela idêntica a Produtos (Qtd/Valor/Misto + sparkline + drawer)
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Loading } from '../components/UI';

const fmt    = (n,d=0) => n==null||isNaN(n)||n===''?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtR   = (n) => { if(n==null||isNaN(n)||n==='') return '—'; const v=Number(n); if(v>=1e6) return 'R$'+fmt(v/1e6,1)+'M'; if(v>=1e3) return 'R$'+fmt(v/1e3,1)+'K'; return 'R$'+fmt(v,0); };
const fmtM   = (n) => n==null||isNaN(n)||n===''?'—':fmt(n,1)+'%';
const fmtFull= (n) => n==null||isNaN(n)||n===''?'—':'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtQtd = (n) => !n||Number(n)===0?'—':fmt(Number(n),0)+' un';

const STATUS_CFG = [
  { s:'ADEQUADO',    c:'#22c55e', icon:'✅', rec:'Manter rotina de compras. Cobertura saudável.' },
  { s:'BAIXO',       c:'#f97316', icon:'📉', rec:'Programar compra preventiva. Cobertura abaixo do ideal.' },
  { s:'CRITICO',     c:'#C8102E', icon:'⚠️', rec:'Ação imediata — risco de ruptura de fornecimento.' },
  { s:'EXCESSO',     c:'#f59e0b', icon:'📦', rec:'Reduzir compras. Criar promoções para girar estoque.' },
  { s:'SEM ESTOQUE', c:'#6b7280', icon:'❌', rec:'Reposição urgente — verificar fornecedor imediatamente.' },
  { s:'SEM VENDA',   c:'#334155', icon:'💤', rec:'Avaliar descontinuação ou promoção agressiva.' },
];
const COR = Object.fromEntries(STATUS_CFG.map(s=>[s.s,s.c]));
const MESES_LABEL = ['Ago/25','Set/25','Out/25','Nov/25','Dez/25','Jan/26'];

// ─── Badge ───────────────────────────────────────────────────
function SBadge({ s }) {
  const c=COR[s]||'#555';
  return <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontWeight:700,
    background:`${c}18`,border:`1px solid ${c}33`,color:c,whiteSpace:'nowrap'}}>{s||'—'}</span>;
}

// ─── Sparkline inline ─────────────────────────────────────────
function Spark({ vals, cor='#C8102E', w=56, h=20 }) {
  if(!vals?.length||vals.every(v=>v===0)) return <span style={{fontSize:9,color:'#333'}}>—</span>;
  const max=Math.max(...vals,1);
  const xs=vals.map((_,i)=>2+(i/(vals.length-1||1))*(w-4));
  const ys=vals.map(v=>2+(1-v/max)*(h-4));
  const d=xs.map((x,i)=>`${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:w,height:h,display:'block'}}>
      <path d={d} fill="none" stroke={cor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="2" fill={cor}/>
    </svg>
  );
}

// ─── Drawer de detalhes do item ───────────────────────────────
function ItemDrawer({ row, onClose }) {
  const [viewMode, setViewMode] = useState('qtd');
  if (!row) return null;

  const qtds = [row.qtd_mes6,row.qtd_mes5,row.qtd_mes4,row.qtd_mes3,row.qtd_mes2,row.qtd_mes1].map(Number);
  const vlrs = [row.vlr_mes6,row.vlr_mes5,row.vlr_mes4,row.vlr_mes3,row.vlr_mes2,row.vlr_mes1].map(Number);
  const vals  = viewMode==='qtd' ? qtds : vlrs;
  const maxV  = Math.max(...vals,1);
  const mPct  = Number(row.margem_pct_filial||0);
  const cob   = Number(row.cobertura_meses_filial||0);
  const corM  = mPct>=50?'#22c55e':mPct>=30?'#f59e0b':'#C8102E';
  const corC  = cob<=1?'#C8102E':cob<=3?'#f59e0b':'#22c55e';
  const corSt = COR[row.status_cobertura_filial]||'#555';

  return (
    <div style={{position:'fixed',inset:0,zIndex:9000,display:'flex',justifyContent:'flex-end'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'rgba(0,0,0,.65)',position:'absolute',inset:0}} onClick={onClose}/>
      <div style={{position:'relative',width:500,background:'#0f0f0f',borderLeft:'1px solid #222',
        height:'100%',overflowY:'auto',display:'flex',flexDirection:'column',zIndex:1}}>

        {/* Header */}
        <div style={{padding:'20px 24px',borderBottom:'1px solid #1a1a1a',background:'#161616',flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:'monospace',fontSize:11,color:'#444',marginBottom:4}}>{row.referencia}</div>
              <div style={{fontWeight:800,fontSize:15,color:'#fff',lineHeight:1.3,paddingRight:12}}>{row.descricao}</div>
            </div>
            <button onClick={onClose} style={{background:'#1f1f1f',border:'1px solid #2a2a2a',borderRadius:8,
              padding:'6px 12px',color:'#666',cursor:'pointer',fontSize:18,flexShrink:0}}>✕</button>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <span style={{background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.3)',
              borderRadius:5,padding:'3px 10px',fontWeight:700,color:'#f59e0b',fontSize:11}}>{row.filial}</span>
            <span style={{background:'#1f1f1f',border:'1px solid #2a2a2a',borderRadius:5,
              padding:'3px 10px',color:'#777',fontSize:11}}>{row.grupo}{row.sub_grupo?` › ${row.sub_grupo}`:''}</span>
            <SBadge s={row.status_cobertura_filial}/>
          </div>
        </div>

        <div style={{padding:'18px 24px',display:'flex',flexDirection:'column',gap:14}}>

          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[
              {l:'Qtd vendida 6m',   v:fmtQtd(row.qtd_vendida_filial_6m), c:'#22c55e'},
              {l:'Qtd vendida mês',  v:fmtQtd(row.qtd_vendida_filial_mes),c:'#14b8a6'},
              {l:'Saldo estoque',    v:fmtQtd(row.saldo_estoque_filial),   c:'#60a5fa'},
              {l:'Média mensal',     v:fmtQtd(row.media_mensal_qtd_filial),c:'#f59e0b'},
              {l:'Valor vendas 6m',  v:fmtFull(row.vlr_vendido_filial_6m), c:'#a855f7'},
              {l:'Margem %',         v:fmtM(mPct),                         c:corM},
            ].map(k=>(
              <div key={k.l} style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:9,color:'#444',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>{k.l}</div>
                <div style={{fontFamily:'monospace',fontSize:14,fontWeight:700,color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Cobertura e estoque */}
          <div style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>📦 Estoque & Cobertura</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {[
                {l:'Cobertura',           v:cob>0?cob.toFixed(1)+' meses ('+fmt(row.cobertura_dias_filial)+' dias)':'—', c:corC},
                {l:'Custo médio',         v:fmtFull(row.custo_medio_filial)},
                {l:'Preço médio venda',   v:fmtFull(row.preco_medio_venda_filial)},
                {l:'Valor em estoque',    v:fmtFull(row.valor_estoque_filial)},
                {l:'Qtd recebida NSD 6m', v:fmtQtd(row.qtd_recebida_nsd_6m)},
                {l:'Meses com venda',     v:fmt(row.meses_com_venda_filial)+' meses'},
              ].map(d=>(
                <div key={d.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #1a1a1a'}}>
                  <span style={{fontSize:11,color:'#555'}}>{d.l}</span>
                  <span style={{fontSize:11,fontFamily:'monospace',color:d.c||'#ccc',fontWeight:600}}>{d.v||'—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerta visual para status crítico */}
          {(row.status_cobertura_filial==='CRITICO'||row.status_cobertura_filial==='SEM ESTOQUE')&&(
            <div style={{background:`${corSt}0d`,border:`1px solid ${corSt}33`,borderRadius:8,
              padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:20}}>{STATUS_CFG.find(s=>s.s===row.status_cobertura_filial)?.icon}</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:corSt}}>{row.status_cobertura_filial}</div>
                <div style={{fontSize:10,color:'#888',marginTop:2}}>
                  {STATUS_CFG.find(s=>s.s===row.status_cobertura_filial)?.rec}
                </div>
              </div>
            </div>
          )}

          {/* Histórico mensal — toggle Qtd / Valor */}
          <div style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:10,padding:'14px 16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1}}>📅 Histórico Mensal</div>
              <div style={{display:'flex',gap:4}}>
                {[{k:'qtd',l:'Quantidade'},{k:'vlr',l:'Valor'}].map(m=>(
                  <button key={m.k} onClick={()=>setViewMode(m.k)}
                    style={{fontSize:9,padding:'3px 8px',borderRadius:5,fontWeight:700,cursor:'pointer',
                      background:viewMode===m.k?'rgba(200,16,46,.2)':'transparent',
                      border:`1px solid ${viewMode===m.k?'rgba(200,16,46,.5)':'#2a2a2a'}`,
                      color:viewMode===m.k?'#C8102E':'#555'}}>
                    {m.l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {MESES_LABEL.map((mes,i)=>{
                const val  = vals[i]||0;
                const pct  = (val/maxV*100).toFixed(1);
                const isL  = i===MESES_LABEL.length-1;
                return (
                  <div key={mes}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:11,color:isL?'#C8102E':'#777',fontWeight:isL?700:400}}>{mes}</span>
                      <div style={{display:'flex',gap:12}}>
                        {viewMode==='qtd'
                          ? <span style={{fontSize:11,fontFamily:'monospace',color:isL?'#f0f0f0':'#aaa',fontWeight:isL?700:400}}>
                              {val>0?fmt(val,0)+' un':'—'}
                            </span>
                          : <>
                              <span style={{fontSize:10,color:'#444'}}>{qtds[i]>0?fmt(qtds[i],0)+' un':''}</span>
                              <span style={{fontSize:11,fontFamily:'monospace',color:isL?'#f0f0f0':'#aaa',fontWeight:isL?700:400}}>
                                {val>0?fmtFull(val):'—'}
                              </span>
                            </>
                        }
                      </div>
                    </div>
                    <div style={{height:6,background:'#1a1a1a',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,
                        background:isL?'#C8102E':viewMode==='qtd'?'#3b82f6':'#2a3a4a',
                        borderRadius:3,transition:'width .4s'}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KPI card de status ───────────────────────────────────────
function StatusCard({ si, v, pct, vendas6m, valorEst, isSel, onClick }) {
  const [hov,setHov]=useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:isSel?`${si.c}14`:hov?'#1c1c1c':'#161616',
        border:`1px solid ${isSel?si.c:hov?si.c+'44':'#1e1e1e'}`,
        borderTop:`3px solid ${si.c}`,borderRadius:10,padding:'14px',cursor:'pointer',
        transition:'all .15s',transform:hov&&!isSel?'translateY(-2px)':'none',
        boxShadow:hov?`0 6px 20px ${si.c}18`:'none',position:'relative',overflow:'hidden'}}>
      {isSel&&<div style={{position:'absolute',top:6,right:8,fontSize:9,color:si.c,fontWeight:700}}>ATIVO ✓</div>}
      <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:1,color:hov?si.c:'#666',marginBottom:4,transition:'color .15s'}}>
        {si.icon} {si.s}
      </div>
      <div style={{fontFamily:'Bebas Neue',fontSize:30,color:si.c,lineHeight:1,marginBottom:4}}>{fmt(v)}</div>
      <div style={{fontSize:10,color:'#555',marginBottom:6}}>{pct.toFixed(1)}% do total</div>
      <div style={{height:3,background:'#1a1a1a',borderRadius:2,overflow:'hidden',marginBottom:6}}>
        <div style={{height:'100%',width:`${pct}%`,background:si.c,borderRadius:2,transition:'width .6s ease'}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#555'}}>
        <span>Vendas: <span style={{color:'#888',fontFamily:'monospace'}}>{fmtR(vendas6m)}</span></span>
        <span>Est: <span style={{color:'#888',fontFamily:'monospace'}}>{fmtR(valorEst)}</span></span>
      </div>
    </div>
  );
}

// ─── Barra de distribuição interativa ────────────────────────
function DistBar({ si, v, pct, vendas6m, valorEst, isSel, onClick }) {
  const [hov,setHov]=useState(false);
  return (
    <div style={{marginBottom:12,cursor:'pointer'}} onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:5,alignItems:'center'}}>
        <span style={{color:hov||isSel?si.c:'#aaa',fontWeight:700,transition:'color .12s'}}>{si.icon} {si.s}</span>
        <div style={{display:'flex',gap:14,fontSize:10}}>
          <span style={{color:hov?si.c:'#555',fontFamily:'monospace',fontWeight:hov?700:400,transition:'all .12s'}}>
            {fmt(v)} itens · {pct.toFixed(1)}%
          </span>
          <span style={{fontFamily:'monospace',color:'#555'}}>{fmtR(valorEst)}</span>
        </div>
      </div>
      <div style={{height:22,background:'#1a1a1a',borderRadius:4,overflow:'hidden',position:'relative'}}>
        <div style={{height:'100%',width:`${pct}%`,
          background:hov||isSel?`linear-gradient(90deg,${si.c}ee,${si.c}88)`:`${si.c}88`,
          borderRadius:4,display:'flex',alignItems:'center',paddingLeft:8,
          fontSize:9,fontWeight:700,color:'rgba(255,255,255,.88)',transition:'width .5s, background .14s'}}>
          {pct>8?fmtR(vendas6m):''}
        </div>
        {pct<=8&&Number(vendas6m)>0&&(
          <span style={{position:'absolute',left:`calc(${pct}% + 8px)`,top:'50%',
            transform:'translateY(-50%)',fontSize:9,color:'#555'}}>{fmtR(vendas6m)}</span>
        )}
      </div>
    </div>
  );
}

// ─── Card de ação recomendada ─────────────────────────────────
function AcaoCard({ si, v, d, isSel, onClick, onNavegar }) {
  const [hov,setHov]=useState(false);
  return (
    <div style={{display:'flex',gap:10,padding:'10px 12px',borderRadius:8,marginBottom:7,
      background:isSel?`${si.c}10`:hov?'#1a1a1a':'#111',
      border:`1px solid ${isSel?si.c+'44':hov?'#2a2a2a':'transparent'}`,
      cursor:'pointer',transition:'all .14s'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={onClick}>
      <div style={{width:9,height:9,borderRadius:'50%',background:si.c,marginTop:3,flexShrink:0,
        boxShadow:hov?`0 0 8px ${si.c}88`:'none',transition:'box-shadow .14s'}}/>
      <div style={{flex:1}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
          <div style={{fontSize:11,fontWeight:700,color:'#f0f0f0'}}>
            {si.s} — <span style={{color:si.c}}>{fmt(v)} itens</span>
          </div>
          {hov&&(
            <button onClick={e=>{e.stopPropagation();onNavegar();}}
              style={{fontSize:9,padding:'2px 7px',borderRadius:4,fontWeight:700,cursor:'pointer',
                background:`${si.c}20`,border:`1px solid ${si.c}44`,color:si.c}}>
              Ver produtos →
            </button>
          )}
        </div>
        <div style={{fontSize:10,color:'#666'}}>{si.rec}</div>
        <div style={{fontSize:10,color:'#444',marginTop:3,fontFamily:'monospace'}}>
          Vendas: {fmtR(d.vendas_6m)} · Est: {fmtR(d.valor_estoque)}
        </div>
      </div>
    </div>
  );
}

// ─── Cabeçalho de coluna ordenável ───────────────────────────
function TH({ label, k, curr, asc, onSort, align='left' }) {
  const act=curr===k;
  return (
    <th onClick={()=>onSort(k)} style={{background:'#141414',textAlign:align,fontSize:10,
      textTransform:'uppercase',letterSpacing:.8,color:act?'#C8102E':'#555',padding:'9px 10px',
      borderBottom:'1px solid #1e1e1e',fontWeight:600,whiteSpace:'nowrap',
      cursor:'pointer',userSelect:'none',position:'sticky',top:0,zIndex:2,transition:'color .12s'}}>
      {label} {act?(asc?'↑':'↓'):<span style={{color:'#2a2a2a'}}>↕</span>}
    </th>
  );
}

const MODOS_COL = [{key:'qtd',label:'Quantidade'},{key:'vlr',label:'Valor R$'},{key:'misto',label:'Misto'}];

// ════════════════════════════════════════════════════════════════
export default function Cobertura() {
  const navigate  = useNavigate();
  const searchRef = useRef(null);

  const [filialSel, setFilialSel] = useState('Todas');
  const [filiais,   setFiliais]   = useState([]);
  const [dist,      setDist]      = useState([]);
  const [criticos,  setCriticos]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [statusFil, setStatusFil] = useState('');
  const [search,    setSearch]    = useState('');
  const [sortKey,   setSortKey]   = useState('vlr_vendido_filial_6m');
  const [sortAsc,   setSortAsc]   = useState(false);
  const [hovRow,    setHovRow]    = useState(null);
  const [drawer,    setDrawer]    = useState(null);
  const [modoCol,   setModoCol]   = useState('qtd');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = filialSel!=='Todas'?{filial:filialSel}:{};
      const [c,fl] = await Promise.all([
        api.get('/kpis/cobertura-filiais',{params:p}),
        api.get('/kpis/filiais'),
      ]);
      setDist(c.data.distribuicao||[]);
      setCriticos(c.data.criticos||[]);
      setFiliais(fl.data||[]);
    } catch(e){console.error(e);}
    finally{setLoading(false);}
  },[filialSel]);

  useEffect(()=>{load();},[load]);

  useEffect(()=>{
    const fn=e=>{
      if(e.key==='/'&&document.activeElement!==searchRef.current){e.preventDefault();searchRef.current?.focus();}
      if(e.key==='Escape'){setDrawer(null);setStatusFil('');setSearch('');}
    };
    window.addEventListener('keydown',fn);
    return()=>window.removeEventListener('keydown',fn);
  },[]);

  function handleSort(k){if(sortKey===k)setSortAsc(a=>!a);else{setSortKey(k);setSortAsc(false);}}

  const total   = dist.reduce((a,r)=>a+Number(r.total),0)||1;
  const distMap = Object.fromEntries(dist.map(r=>[r.status,r]));
  const empty   = dist.length===0&&!loading;

  const itensFilt = criticos
    .filter(r=>{
      if(statusFil&&r.status_cobertura_filial!==statusFil) return false;
      if(search){const q=search.toLowerCase();return r.referencia?.toLowerCase().includes(q)||r.descricao?.toLowerCase().includes(q)||r.grupo?.toLowerCase().includes(q);}
      return true;
    })
    .sort((a,b)=>{
      const va=isNaN(Number(a[sortKey]))?String(a[sortKey]||''):Number(a[sortKey]||0);
      const vb=isNaN(Number(b[sortKey]))?String(b[sortKey]||''):Number(b[sortKey]||0);
      if(typeof va==='string') return sortAsc?va.localeCompare(vb):vb.localeCompare(va);
      return sortAsc?va-vb:vb-va;
    });

  const temFiltro=statusFil||search;

  // Colunas dinâmicas por modo
  const renderCols = () => {
    if(modoCol==='qtd') return (
      <>
        <TH label="Vds 6m (un)"  k="qtd_vendida_filial_6m"  curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <TH label="Vds Mês (un)" k="qtd_vendida_filial_mes"  curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <TH label="Est. (un)"    k="saldo_estoque_filial"    curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <TH label="Média/Mês"    k="media_mensal_qtd_filial" curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <th style={{...THST,cursor:'default',color:'#555'}}>Tendência</th>
      </>
    );
    if(modoCol==='vlr') return (
      <>
        <TH label="Vendas 6m"  k="vlr_vendido_filial_6m"  curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <TH label="Vds Mês"    k="vlr_vendido_filial_mes"  curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <TH label="Val.Est."   k="valor_estoque_filial"    curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <TH label="Lucro 6m"   k="lucro_bruto_filial_6m"   curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <th style={{...THST,cursor:'default',color:'#555'}}>Tendência</th>
      </>
    );
    return (
      <>
        <TH label="Vds 6m (un)" k="qtd_vendida_filial_6m" curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <TH label="Vendas 6m"   k="vlr_vendido_filial_6m"  curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <TH label="Est. (un)"   k="saldo_estoque_filial"   curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <TH label="Val.Est."    k="valor_estoque_filial"   curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
        <th style={{...THST,cursor:'default',color:'#555'}}>Tendência</th>
      </>
    );
  };

  const renderCells = (r) => {
    const q6=Number(r.qtd_vendida_filial_6m||0);
    const qM=Number(r.qtd_vendida_filial_mes||0);
    const es=Number(r.saldo_estoque_filial||0);
    const md=Number(r.media_mensal_qtd_filial||0);
    const sparkQ=[r.qtd_mes6,r.qtd_mes5,r.qtd_mes4,r.qtd_mes3,r.qtd_mes2,r.qtd_mes1].map(Number);
    const sparkV=[r.vlr_mes6,r.vlr_mes5,r.vlr_mes4,r.vlr_mes3,r.vlr_mes2,r.vlr_mes1].map(Number);
    const corS=COR[r.status_cobertura_filial]||'#555';

    if(modoCol==='qtd') return (
      <>
        <td style={{...TD,color:'#22c55e',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{q6>0?fmt(q6)+' un':'—'}</td>
        <td style={{...TD,color:'#14b8a6',fontFamily:'monospace',textAlign:'right'}}>{qM>0?fmt(qM)+' un':'—'}</td>
        <td style={{...TD,color:'#60a5fa',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{es>0?fmt(es)+' un':'—'}</td>
        <td style={{...TD,color:'#888',fontFamily:'monospace',textAlign:'right'}}>{md>0?fmt(md,1)+' un':'—'}</td>
        <td style={TD}><Spark vals={sparkQ} cor={corS}/></td>
      </>
    );
    if(modoCol==='vlr') return (
      <>
        <td style={{...TD,color:'#22c55e',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.vlr_vendido_filial_6m)}</td>
        <td style={{...TD,color:'#aaa',fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.vlr_vendido_filial_mes)}</td>
        <td style={{...TD,fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.valor_estoque_filial)}</td>
        <td style={{...TD,color:'#14b8a6',fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.lucro_bruto_filial_6m)}</td>
        <td style={TD}><Spark vals={sparkV} cor={corS}/></td>
      </>
    );
    return (
      <>
        <td style={{...TD,color:'#22c55e',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{q6>0?fmt(q6)+' un':'—'}</td>
        <td style={{...TD,color:'#a855f7',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.vlr_vendido_filial_6m)}</td>
        <td style={{...TD,color:'#60a5fa',fontFamily:'monospace',textAlign:'right'}}>{es>0?fmt(es)+' un':'—'}</td>
        <td style={{...TD,fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.valor_estoque_filial)}</td>
        <td style={TD}><Spark vals={sparkQ} cor={corS}/></td>
      </>
    );
  };

  return (
    <>
      {drawer&&<ItemDrawer row={drawer} onClose={()=>setDrawer(null)}/>}
      <div style={{padding:'16px 24px',display:'flex',flexDirection:'column',gap:14}}>

        {/* Filtro de loja */}
        <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',
          background:'#111',border:'1px solid #1a1a1a',borderRadius:9,padding:'9px 14px'}}>
          <span style={{fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:1}}>Loja:</span>
          {['Todas',...filiais.map(f=>f.filial)].map(cod=>(
            <button key={cod} onClick={()=>setFilialSel(cod)}
              style={{background:filialSel===cod?'rgba(200,16,46,.18)':'transparent',
                border:`1px solid ${filialSel===cod?'rgba(200,16,46,.5)':'#222'}`,
                borderRadius:20,padding:'3px 11px',color:filialSel===cod?'#C8102E':'#555',
                fontSize:11,fontWeight:700,cursor:'pointer',transition:'all .13s'}}>
              {cod}
            </button>
          ))}
          {filialSel!=='Todas'&&(
            <button onClick={()=>setFilialSel('Todas')}
              style={{marginLeft:'auto',background:'rgba(200,16,46,.1)',border:'1px solid rgba(200,16,46,.3)',
                borderRadius:20,padding:'3px 11px',color:'#C8102E',fontSize:11,fontWeight:700,cursor:'pointer'}}>
              ✕ Limpar
            </button>
          )}
        </div>

        {loading ? <Loading/> : empty ? (
          <div style={{background:'rgba(200,16,46,.05)',border:'1px solid rgba(200,16,46,.18)',borderRadius:12,padding:40,textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:12}}>📂</div>
            <div style={{fontFamily:'Bebas Neue',fontSize:22,color:'#f0f0f0',letterSpacing:2,marginBottom:8}}>NENHUM DADO IMPORTADO</div>
            <div style={{fontSize:12,color:'#666'}}>Importe <strong style={{color:'#f39c12'}}>atualizado_sql_todas_as_lojas_csv.csv</strong></div>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:9}}>
              {STATUS_CFG.map(si=>{
                const d=distMap[si.s]||{};
                const v=Number(d.total||0);
                return (
                  <StatusCard key={si.s} si={si} v={v} pct={v/total*100}
                    vendas6m={d.vendas_6m} valorEst={d.valor_estoque}
                    isSel={statusFil===si.s}
                    onClick={()=>setStatusFil(s=>s===si.s?'':si.s)}/>
                );
              })}
            </div>

            {/* Distribuição + Ações */}
            <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:12}}>
              <div style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:10,padding:'18px 20px'}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,color:'#888',marginBottom:14}}>
                  Distribuição por Status <span style={{fontSize:9,color:'#444',fontWeight:400}}>· clique para filtrar</span>
                </div>
                {STATUS_CFG.map(si=>{
                  const d=distMap[si.s]||{};
                  const v=Number(d.total||0);
                  return (
                    <DistBar key={si.s} si={si} v={v} pct={v/total*100}
                      vendas6m={d.vendas_6m} valorEst={d.valor_estoque}
                      isSel={statusFil===si.s}
                      onClick={()=>setStatusFil(s=>s===si.s?'':si.s)}/>
                  );
                })}
              </div>
              <div style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:10,padding:'18px 20px'}}>
                <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,color:'#888',marginBottom:12}}>
                  Ações Recomendadas
                </div>
                {STATUS_CFG.map(si=>{
                  const d=distMap[si.s]||{};
                  const v=Number(d.total||0);
                  if(v===0) return null;
                  return (
                    <AcaoCard key={si.s} si={si} v={v} d={d} isSel={statusFil===si.s}
                      onClick={()=>setStatusFil(s=>s===si.s?'':si.s)}
                      onNavegar={()=>navigate('/produtos',{state:{status:si.s,filial:filialSel!=='Todas'?filialSel:''}})}/>
                  );
                })}
              </div>
            </div>

            {/* ══ TABELA — idêntica a Produtos ══ */}
            <div style={{background:'#111',border:'1px solid #1a1a1a',borderRadius:10,overflow:'hidden'}}>

              {/* Header */}
              <div style={{padding:'10px 16px',display:'flex',justifyContent:'space-between',
                alignItems:'center',borderBottom:'1px solid #1a1a1a',flexWrap:'wrap',gap:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{fontFamily:'Bebas Neue',fontSize:18,letterSpacing:1.5,color:'#f0f0f0'}}>
                    {statusFil||'ITENS CRÍTICOS E SEM ESTOQUE'}
                  </div>
                  <span style={{fontSize:11,color:'#555'}}>
                    {itensFilt.length} itens
                    {filialSel!=='Todas'&&<span style={{color:'#C8102E',marginLeft:4}}>· {filialSel}</span>}
                  </span>
                  {loading&&<span style={{fontSize:11,color:'#555'}}>⟳</span>}
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="🔍 Buscar... (/)"
                    style={{background:'#161616',border:'1px solid #2a2a2a',borderRadius:7,
                      padding:'6px 12px',color:'#f0f0f0',fontSize:11,width:200,
                      outline:'none',transition:'border .13s'}}
                    onFocus={e=>e.target.style.borderColor='#C8102E'}
                    onBlur={e=>e.target.style.borderColor='#2a2a2a'}/>
                  {/* Seletor de modo — igual Produtos */}
                  <div style={{display:'flex',gap:3}}>
                    {MODOS_COL.map(m=>(
                      <button key={m.key} onClick={()=>setModoCol(m.key)}
                        style={{fontSize:10,padding:'5px 9px',borderRadius:6,fontWeight:700,cursor:'pointer',
                          background:modoCol===m.key?'rgba(200,16,46,.18)':'#161616',
                          border:`1px solid ${modoCol===m.key?'rgba(200,16,46,.5)':'#2a2a2a'}`,
                          color:modoCol===m.key?'#C8102E':'#555',transition:'all .13s'}}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {temFiltro&&(
                    <button onClick={()=>{setStatusFil('');setSearch('');}}
                      style={{background:'rgba(200,16,46,.1)',border:'1px solid rgba(200,16,46,.3)',
                        borderRadius:7,padding:'5px 12px',color:'#C8102E',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                      ✕ Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Chips de status */}
              <div style={{display:'flex',gap:5,padding:'7px 16px',borderBottom:'1px solid #1a1a1a',
                background:'#0d0d0d',flexWrap:'wrap',alignItems:'center'}}>
                <span style={{fontSize:9,color:'#333',textTransform:'uppercase',letterSpacing:1,marginRight:4}}>Filtro rápido:</span>
                {STATUS_CFG.map(si=>(
                  <button key={si.s} onClick={()=>setStatusFil(s=>s===si.s?'':si.s)}
                    style={{fontSize:10,padding:'3px 10px',borderRadius:20,fontWeight:700,cursor:'pointer',
                      background:statusFil===si.s?si.c:`${si.c}14`,
                      border:`1px solid ${si.c}${statusFil===si.s?'':'33'}`,
                      color:statusFil===si.s?'#fff':si.c,transition:'all .13s'}}>
                    {si.icon} {si.s}
                  </button>
                ))}
                <span style={{marginLeft:'auto',fontSize:10,color:'#C8102E',
                  background:'rgba(200,16,46,.08)',border:'1px solid rgba(200,16,46,.2)',
                  borderRadius:5,padding:'2px 8px'}}>
                  clique na linha para detalhes completos
                </span>
              </div>

              {/* Tabela */}
              <div style={{overflowX:'auto',maxHeight:520,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr>
                      <TH label="Loja"       k="filial"                  curr={sortKey} asc={sortAsc} onSort={handleSort}/>
                      <TH label="Referência" k="referencia"              curr={sortKey} asc={sortAsc} onSort={handleSort}/>
                      <TH label="Descrição"  k="descricao"               curr={sortKey} asc={sortAsc} onSort={handleSort}/>
                      <TH label="Grupo"      k="grupo"                   curr={sortKey} asc={sortAsc} onSort={handleSort}/>
                      <TH label="Status"     k="status_cobertura_filial" curr={sortKey} asc={sortAsc} onSort={handleSort}/>
                      {renderCols()}
                      <TH label="Margem"     k="margem_pct_filial"       curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
                      <TH label="Cobertura"  k="cobertura_meses_filial"  curr={sortKey} asc={sortAsc} onSort={handleSort} align="right"/>
                    </tr>
                  </thead>
                  <tbody>
                    {itensFilt.map((r,i)=>{
                      const mPct=Number(r.margem_pct_filial||0);
                      const cob =Number(r.cobertura_meses_filial||0);
                      const corM=mPct>=50?'#22c55e':mPct>=30?'#f59e0b':mPct>0?'#C8102E':'#555';
                      const corC=cob<=1?'#C8102E':cob<=3?'#f59e0b':'#22c55e';
                      const isH =hovRow===i;
                      return (
                        <tr key={i}
                          style={{borderBottom:'1px solid #161616',cursor:'pointer',
                            background:isH?'rgba(200,16,46,.07)':i%2===0?'transparent':'rgba(255,255,255,.01)',
                            transition:'background .08s'}}
                          onClick={()=>setDrawer(r)}
                          onMouseEnter={()=>setHovRow(i)} onMouseLeave={()=>setHovRow(null)}>
                          <td style={TD}>
                            <span style={{background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.22)',
                              borderRadius:4,padding:'2px 7px',fontWeight:700,color:'#f59e0b',fontSize:10}}>
                              {r.filial}
                            </span>
                          </td>
                          <td style={{...TD,fontFamily:'monospace',fontSize:10,color:'#555'}}>{r.referencia}</td>
                          <td style={{...TD,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#ddd'}} title={r.descricao}>{r.descricao}</td>
                          <td style={{...TD,fontWeight:700,color:'#aaa'}}>{r.grupo}</td>
                          <td style={TD}><SBadge s={r.status_cobertura_filial}/></td>
                          {renderCells(r)}
                          <td style={{...TD,fontWeight:700,color:corM,textAlign:'right'}}>{mPct>0?fmtM(mPct):'—'}</td>
                          <td style={{...TD,color:corC,textAlign:'right'}}>{cob>0?cob.toFixed(1)+'m':'—'}</td>
                        </tr>
                      );
                    })}
                    {itensFilt.length===0&&(
                      <tr><td colSpan={12} style={{textAlign:'center',padding:28,color:'#444',fontSize:12}}>
                        {temFiltro?'Nenhum item encontrado.':'Nenhum item crítico ou sem estoque.'}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rodapé */}
              {itensFilt.length>0&&(
                <div style={{display:'flex',gap:20,padding:'9px 16px',borderTop:'1px solid #1a1a1a',
                  background:'#0d0d0d',fontSize:10,color:'#555',flexWrap:'wrap'}}>
                  <span>{itensFilt.length} itens exibidos</span>
                  <span>Vendas 6m: <span style={{color:'#22c55e',fontFamily:'monospace',fontWeight:700}}>
                    {fmtR(itensFilt.reduce((a,r)=>a+Number(r.vlr_vendido_filial_6m||0),0))}</span></span>
                  <span>Val. Estoque: <span style={{color:'#f59e0b',fontFamily:'monospace',fontWeight:700}}>
                    {fmtR(itensFilt.reduce((a,r)=>a+Number(r.valor_estoque_filial||0),0))}</span></span>
                  <span>Qtd vendida: <span style={{color:'#60a5fa',fontFamily:'monospace',fontWeight:700}}>
                    {fmt(itensFilt.reduce((a,r)=>a+Number(r.qtd_vendida_filial_6m||0),0))} un</span></span>
                  <span style={{marginLeft:'auto',color:'#2a2a2a'}}>Esc = limpar · / = buscar</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

const TD   = {padding:'8px 10px',color:'#f0f0f0',whiteSpace:'nowrap'};
const THST = {background:'#141414',fontSize:10,textTransform:'uppercase',letterSpacing:.8,
  color:'#555',padding:'9px 10px',borderBottom:'1px solid #1e1e1e',fontWeight:600,
  whiteSpace:'nowrap',position:'sticky',top:0,zIndex:2};
