// src/pages/Produtos.jsx — colunas em QUANTIDADE + máxima interatividade
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import { Card, Loading } from '../components/UI';

const fmt    = (n,d=0) => n==null||isNaN(n)||n===''?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtR   = (n) => { if(n==null||isNaN(n)||n==='') return '—'; const v=Number(n); if(v>=1e6) return 'R$'+fmt(v/1e6,2)+'M'; if(v>=1e3) return 'R$'+fmt(v/1e3,1)+'K'; return 'R$'+fmt(v,0); };
const fmtM   = (n) => n==null||isNaN(n)||n===''?'—':fmt(n,1)+'%';
const fmtFull= (n) => n==null||isNaN(n)||n===''?'—':'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtQtd = (n) => n==null||isNaN(n)||Number(n)===0?'—':fmt(Number(n),0)+' un';

const STATUS_COR = {
  'ADEQUADO':'#22c55e','BAIXO':'#f97316','CRITICO':'#C8102E',
  'EXCESSO':'#f59e0b','SEM ESTOQUE':'#6b7280','SEM VENDA':'#334155',
};
const MESES_LABEL = ['Ago/25','Set/25','Out/25','Nov/25','Dez/25','Jan/26'];

function SBadge({ s }) {
  const c = STATUS_COR[s]||'#555';
  return <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontWeight:700,background:`${c}18`,border:`1px solid ${c}33`,color:c,whiteSpace:'nowrap'}}>{s||'—'}</span>;
}

// ─── Mini sparkline SVG ───────────────────────────────────────
function Spark({ vals, cor='#C8102E', w=56, h=20 }) {
  if (!vals?.length || vals.every(v=>v===0)) return <span style={{fontSize:9,color:'#333'}}>—</span>;
  const max = Math.max(...vals, 1);
  const xs  = vals.map((_,i) => 2 + (i/(vals.length-1))*(w-4));
  const ys  = vals.map(v => 2 + (1-v/max)*(h-4));
  const d   = xs.map((x,i)=>`${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:w,height:h,display:'block'}}>
      <path d={d} fill="none" stroke={cor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="2" fill={cor}/>
    </svg>
  );
}

// ─── Drawer de detalhes ───────────────────────────────────────
function ProdutoDrawer({ row, onClose }) {
  const [viewMode, setViewMode] = useState('qtd'); // 'qtd' | 'vlr'
  if (!row) return null;

  const qtds = [row.qtd_mes6,row.qtd_mes5,row.qtd_mes4,row.qtd_mes3,row.qtd_mes2,row.qtd_mes1].map(Number);
  const vlrs = [row.vlr_mes6,row.vlr_mes5,row.vlr_mes4,row.vlr_mes3,row.vlr_mes2,row.vlr_mes1].map(Number);
  const vals  = viewMode==='qtd' ? qtds : vlrs;
  const maxV  = Math.max(...vals, 1);
  const cor   = STATUS_COR[row.status_cobertura_filial]||'#555';
  const mPct  = Number(row.margem_pct_filial||0);
  const corM  = mPct>=50?'#22c55e':mPct>=30?'#f59e0b':'#C8102E';

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

          {/* KPIs em quantidade e valor */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[
              {l:'Qtd vendida 6m',    v:fmtQtd(row.qtd_vendida_filial_6m),  c:'#22c55e'},
              {l:'Qtd vendida mês',   v:fmtQtd(row.qtd_vendida_filial_mes), c:'#14b8a6'},
              {l:'Saldo estoque',     v:fmtQtd(row.saldo_estoque_filial),    c:'#60a5fa'},
              {l:'Média mensal qtd',  v:fmtQtd(row.media_mensal_qtd_filial), c:'#f59e0b'},
              {l:'Valor vendas 6m',   v:fmtFull(row.vlr_vendido_filial_6m),  c:'#a855f7'},
              {l:'Margem %',          v:fmtM(mPct),                          c:corM},
            ].map(k=>(
              <div key={k.l} style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:9,color:'#444',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>{k.l}</div>
                <div style={{fontFamily:'monospace',fontSize:14,fontWeight:700,color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Detalhes do estoque */}
          <div style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>📦 Estoque & Preços</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {[
                {l:'Custo médio',          v:fmtFull(row.custo_medio_filial)},
                {l:'Preço médio de venda',  v:fmtFull(row.preco_medio_venda_filial)},
                {l:'Valor em estoque',      v:fmtFull(row.valor_estoque_filial)},
                {l:'Qtd recebida NSD 6m',   v:fmtQtd(row.qtd_recebida_nsd_6m)},
                {l:'Meses com venda',       v:fmt(row.meses_com_venda_filial)+' meses'},
                {l:'Cobertura',             v:Number(row.cobertura_meses_filial)>0?Number(row.cobertura_meses_filial).toFixed(1)+' meses ('+fmt(row.cobertura_dias_filial)+' dias)':'—'},
              ].map(d=>(
                <div key={d.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #1a1a1a'}}>
                  <span style={{fontSize:11,color:'#555'}}>{d.l}</span>
                  <span style={{fontSize:11,fontFamily:'monospace',color:'#ccc',fontWeight:600}}>{d.v||'—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico mensal */}
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
                const val = vals[i]||0;
                const pct = (val/maxV*100).toFixed(1);
                const isLast = i===MESES_LABEL.length-1;
                return (
                  <div key={mes}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:11,color:isLast?'#C8102E':'#777',fontWeight:isLast?700:400}}>{mes}</span>
                      <div style={{display:'flex',gap:12}}>
                        {viewMode==='qtd'
                          ? <span style={{fontSize:11,fontFamily:'monospace',color:isLast?'#f0f0f0':'#aaa',fontWeight:isLast?700:400}}>{val>0?fmt(val,0)+' un':'—'}</span>
                          : <>
                              <span style={{fontSize:10,color:'#444'}}>{qtds[i]>0?fmt(qtds[i],0)+' un':''}</span>
                              <span style={{fontSize:11,fontFamily:'monospace',color:isLast?'#f0f0f0':'#aaa',fontWeight:isLast?700:400}}>{val>0?fmtFull(val):'—'}</span>
                            </>
                        }
                      </div>
                    </div>
                    <div style={{height:6,background:'#1a1a1a',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${pct}%`,
                        background:isLast?'#C8102E':viewMode==='qtd'?'#3b82f6':'#2a3a4a',
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

// ─── Componente principal ─────────────────────────────────────
// Modos de visualização das colunas: quantidade vs valor
const MODOS_COL = [
  { key:'qtd',  label:'Quantidade' },
  { key:'vlr',  label:'Valor R$'   },
  { key:'misto',label:'Misto'      },
];

// Colunas disponíveis para ordenação
const SORT_WHITELIST = new Set([
  'vlr_vendido_filial_6m','valor_estoque_filial','saldo_estoque_filial',
  'vlr_vendido_filial_mes','lucro_bruto_filial_6m','margem_pct_filial',
  'cobertura_meses_filial','media_mensal_qtd_filial','referencia','grupo','filial',
  'qtd_vendida_filial_6m','qtd_vendida_filial_mes',
]);

export default function Produtos() {
  const location  = useLocation();
  const nav       = location.state || {};
  const searchRef = useRef(null);

  const [rows,      setRows]      = useState([]);
  const [total,     setTotal]     = useState(0);
  const [kpis,      setKpis]      = useState(null);
  const [filiais,   setFiliais]   = useState([]);
  const [grupos,    setGrupos]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [drawer,    setDrawer]    = useState(null);

  const [filialSel, setFilialSel] = useState(nav.filial || '');
  const [grupoSel,  setGrupoSel]  = useState(nav.grupo  || '');
  const [statusSel, setStatusSel] = useState(nav.status || '');
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(0);
  const [sortKey,   setSortKey]   = useState('qtd_vendida_filial_6m');
  const [sortAsc,   setSortAsc]   = useState(false);
  const [modoCol,   setModoCol]   = useState('qtd'); // qtd | vlr | misto
  const [hovRow,    setHovRow]    = useState(null);

  const LIMIT = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit:LIMIT, offset:page*LIMIT, sort:sortKey, order:sortAsc?'ASC':'DESC' };
      if (filialSel) params.filial = filialSel;
      if (grupoSel)  params.grupo  = grupoSel;
      if (statusSel) params.status = statusSel;
      if (search)    params.search = search;
      const { data } = await api.get('/database/estoque-filiais', { params });
      setRows(data.rows||[]);
      setTotal(data.total||0);
      setKpis(data.kpis||null);
      if (data.por_filial?.length) setFiliais(data.por_filial);
      if (data.grupos?.length)     setGrupos(data.grupos.slice(0,60));
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [filialSel, grupoSel, statusSel, search, page, sortKey, sortAsc]);

  useEffect(()=>{ load(); },[load]);

  useEffect(()=>{
    const fn = e=>{
      if(e.key==='/' && !drawer && document.activeElement!==searchRef.current){ e.preventDefault(); searchRef.current?.focus(); }
      if(e.key==='Escape') setDrawer(null);
    };
    window.addEventListener('keydown',fn);
    return ()=>window.removeEventListener('keydown',fn);
  },[drawer]);

  function handleSort(key) {
    if(!SORT_WHITELIST.has(key)) return;
    if(sortKey===key) setSortAsc(a=>!a);
    else{ setSortKey(key); setSortAsc(false); }
    setPage(0);
  }

  function resetFiltros() { setFilialSel('');setGrupoSel('');setStatusSel('');setSearch('');setPage(0); }
  const temFiltro = filialSel||grupoSel||statusSel||search;
  const empty = !loading&&total===0&&!temFiltro;

  // Estilos de th / td
  const TH = (key, align='left') => ({
    background:'#141414', textAlign:align, fontSize:10, textTransform:'uppercase',
    letterSpacing:.8, color:sortKey===key?'#C8102E':'#555', padding:'9px 10px',
    borderBottom:'1px solid #1e1e1e', fontWeight:600, whiteSpace:'nowrap',
    cursor:'pointer', userSelect:'none', position:'sticky', top:0, zIndex:2,
    transition:'color .15s',
  });
  const TD = { padding:'8px 10px', whiteSpace:'nowrap' };

  // Colunas renderizadas conforme modo
  const renderCols = () => {
    if (modoCol==='qtd') return (
      <>
        <th style={TH('qtd_vendida_filial_6m','right')} onClick={()=>handleSort('qtd_vendida_filial_6m')}>
          Vds 6m (un) {sortKey==='qtd_vendida_filial_6m'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={TH('qtd_vendida_filial_mes','right')} onClick={()=>handleSort('qtd_vendida_filial_mes')}>
          Vds Mês (un) {sortKey==='qtd_vendida_filial_mes'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={TH('saldo_estoque_filial','right')} onClick={()=>handleSort('saldo_estoque_filial')}>
          Est. (un) {sortKey==='saldo_estoque_filial'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={TH('media_mensal_qtd_filial','right')} onClick={()=>handleSort('media_mensal_qtd_filial')}>
          Média/Mês {sortKey==='media_mensal_qtd_filial'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={{...TH('spark'),...{cursor:'default',color:'#555'}}}>Tendência</th>
      </>
    );
    if (modoCol==='vlr') return (
      <>
        <th style={TH('vlr_vendido_filial_6m','right')} onClick={()=>handleSort('vlr_vendido_filial_6m')}>
          Vendas 6m {sortKey==='vlr_vendido_filial_6m'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={TH('vlr_vendido_filial_mes','right')} onClick={()=>handleSort('vlr_vendido_filial_mes')}>
          Vds Mês {sortKey==='vlr_vendido_filial_mes'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={TH('valor_estoque_filial','right')} onClick={()=>handleSort('valor_estoque_filial')}>
          Val.Est. {sortKey==='valor_estoque_filial'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={TH('lucro_bruto_filial_6m','right')} onClick={()=>handleSort('lucro_bruto_filial_6m')}>
          Lucro 6m {sortKey==='lucro_bruto_filial_6m'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={{...TH('spark'),...{cursor:'default',color:'#555'}}}>Tendência</th>
      </>
    );
    // misto
    return (
      <>
        <th style={TH('qtd_vendida_filial_6m','right')} onClick={()=>handleSort('qtd_vendida_filial_6m')}>
          Vds 6m (un) {sortKey==='qtd_vendida_filial_6m'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={TH('vlr_vendido_filial_6m','right')} onClick={()=>handleSort('vlr_vendido_filial_6m')}>
          Vendas 6m {sortKey==='vlr_vendido_filial_6m'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={TH('saldo_estoque_filial','right')} onClick={()=>handleSort('saldo_estoque_filial')}>
          Est. (un) {sortKey==='saldo_estoque_filial'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={TH('valor_estoque_filial','right')} onClick={()=>handleSort('valor_estoque_filial')}>
          Val.Est. {sortKey==='valor_estoque_filial'?(sortAsc?'↑':'↓'):'↕'}
        </th>
        <th style={{...TH('spark'),...{cursor:'default',color:'#555'}}}>Tendência</th>
      </>
    );
  };

  const renderCells = (r) => {
    const qtd6m = Number(r.qtd_vendida_filial_6m||0);
    const qtdM  = Number(r.qtd_vendida_filial_mes||0);
    const est   = Number(r.saldo_estoque_filial||0);
    const med   = Number(r.media_mensal_qtd_filial||0);
    const sparkVals = [r.qtd_mes6,r.qtd_mes5,r.qtd_mes4,r.qtd_mes3,r.qtd_mes2,r.qtd_mes1].map(Number);
    const sparkVlr  = [r.vlr_mes6,r.vlr_mes5,r.vlr_mes4,r.vlr_mes3,r.vlr_mes2,r.vlr_mes1].map(Number);
    const corS  = STATUS_COR[r.status_cobertura_filial]||'#555';

    if (modoCol==='qtd') return (
      <>
        <td style={{...TD,color:'#22c55e',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{qtd6m>0?fmt(qtd6m)+' un':'—'}</td>
        <td style={{...TD,color:'#14b8a6',fontFamily:'monospace',textAlign:'right'}}>{qtdM>0?fmt(qtdM)+' un':'—'}</td>
        <td style={{...TD,color:'#60a5fa',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{est>0?fmt(est)+' un':'—'}</td>
        <td style={{...TD,color:'#888',fontFamily:'monospace',textAlign:'right'}}>{med>0?fmt(med,1)+' un':'—'}</td>
        <td style={{...TD}}><Spark vals={sparkVals} cor={corS}/></td>
      </>
    );
    if (modoCol==='vlr') return (
      <>
        <td style={{...TD,color:'#22c55e',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.vlr_vendido_filial_6m)}</td>
        <td style={{...TD,color:'#aaa',fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.vlr_vendido_filial_mes)}</td>
        <td style={{...TD,fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.valor_estoque_filial)}</td>
        <td style={{...TD,color:'#14b8a6',fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.lucro_bruto_filial_6m)}</td>
        <td style={{...TD}}><Spark vals={sparkVlr} cor={corS}/></td>
      </>
    );
    return (
      <>
        <td style={{...TD,color:'#22c55e',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{qtd6m>0?fmt(qtd6m)+' un':'—'}</td>
        <td style={{...TD,color:'#a855f7',fontWeight:700,fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.vlr_vendido_filial_6m)}</td>
        <td style={{...TD,color:'#60a5fa',fontFamily:'monospace',textAlign:'right'}}>{est>0?fmt(est)+' un':'—'}</td>
        <td style={{...TD,fontFamily:'monospace',textAlign:'right'}}>{fmtR(r.valor_estoque_filial)}</td>
        <td style={{...TD}}><Spark vals={sparkVals} cor={corS}/></td>
      </>
    );
  };

  // KPI rápido conforme modo
  const kpiPrincipal = kpis ? (
    modoCol==='qtd'
      ? { label:'Qtd Total Vendida 6m', value: fmt(rows.reduce((a,r)=>a+Number(r.qtd_vendida_filial_6m||0),0))+' un', cor:'#22c55e' }
      : { label:'Valor Total Vendas 6m', value: fmtR(kpis.vendas_6m), cor:'#22c55e' }
  ) : null;

  return (
    <>
      {drawer && <ProdutoDrawer row={drawer} onClose={()=>setDrawer(null)}/>}

      {/* ── Barra de filtros ─────────────────────────────── */}
      <div style={{background:'#0d0d0d',borderBottom:'1px solid #1a1a1a',padding:'10px 24px',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>

        <input ref={searchRef} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}
          placeholder="🔍 Buscar referência ou descrição... ( / )"
          style={{background:'#161616',border:'1px solid #2a2a2a',borderRadius:8,padding:'7px 14px',
            color:'#f0f0f0',fontSize:12,width:280,outline:'none',transition:'border .15s'}}
          onFocus={e=>e.target.style.borderColor='#C8102E'}
          onBlur={e=>e.target.style.borderColor='#2a2a2a'}/>

        <select value={filialSel} onChange={e=>{setFilialSel(e.target.value);setPage(0);}}
          style={{background:'#161616',border:'1px solid #2a2a2a',borderRadius:8,padding:'7px 12px',
            color:filialSel?'#f0f0f0':'#555',fontSize:12}}>
          <option value="">🏪 Todas as lojas</option>
          {filiais.map(f=><option key={f.filial} value={f.filial}>{f.filial}{f.nome_loja&&f.nome_loja!==f.filial?' — '+f.nome_loja:''}</option>)}
        </select>

        <select value={grupoSel} onChange={e=>{setGrupoSel(e.target.value);setPage(0);}}
          style={{background:'#161616',border:'1px solid #2a2a2a',borderRadius:8,padding:'7px 12px',
            color:grupoSel?'#f0f0f0':'#555',fontSize:12}}>
          <option value="">🏷️ Todos os grupos</option>
          {grupos.map(g=><option key={g.grupo} value={g.grupo}>{g.grupo}</option>)}
        </select>

        {/* Status chips */}
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          {Object.entries(STATUS_COR).map(([s,c])=>(
            <button key={s} onClick={()=>{setStatusSel(v=>v===s?'':s);setPage(0);}}
              style={{fontSize:10,padding:'4px 10px',borderRadius:20,fontWeight:700,cursor:'pointer',
                background:statusSel===s?c:`${c}14`,border:`1px solid ${c}${statusSel===s?'':'33'}`,
                color:statusSel===s?'#fff':c,transition:'all .15s'}}>
              {s}
            </button>
          ))}
        </div>

        {temFiltro&&(
          <button onClick={resetFiltros}
            style={{background:'rgba(200,16,46,.12)',border:'1px solid rgba(200,16,46,.3)',borderRadius:8,
              padding:'7px 14px',color:'#C8102E',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            ✕ Limpar
          </button>
        )}

        {/* Modo de colunas */}
        <div style={{marginLeft:'auto',display:'flex',gap:4,alignItems:'center'}}>
          <span style={{fontSize:10,color:'#444',marginRight:4}}>Exibir:</span>
          {MODOS_COL.map(m=>(
            <button key={m.key} onClick={()=>setModoCol(m.key)}
              style={{fontSize:10,padding:'5px 10px',borderRadius:6,fontWeight:700,cursor:'pointer',
                background:modoCol===m.key?'rgba(200,16,46,.18)':'#161616',
                border:`1px solid ${modoCol===m.key?'rgba(200,16,46,.5)':'#2a2a2a'}`,
                color:modoCol===m.key?'#C8102E':'#555',transition:'all .15s'}}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:'12px 24px',display:'flex',flexDirection:'column',gap:10}}>

        {/* KPIs */}
        {kpis&&Number(kpis.total_itens)>0&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(8,1fr)',gap:7}}>
            {[
              {icon:'📦',label:'Itens filtrados',  value:fmt(total),                                       cor:'#3b82f6'},
              {icon:'🏪',label:'Lojas',             value:fmt(kpis.total_lojas),                            cor:'#f59e0b'},
              {icon:'📊',label:'Total peças',       value:fmt(kpis.total_pecas||rows.reduce((a,r)=>a+Number(r.saldo_estoque_filial||0),0))+' un', cor:'#60a5fa'},
              {icon:'💼',label:'Valor Estoque',     value:fmtR(kpis.valor_total),                          cor:'#f59e0b'},
              {icon:'🟢',label:'Qtd vendida 6m',    value:fmt(rows.reduce((a,r)=>a+Number(r.qtd_vendida_filial_6m||0),0))+' un', cor:'#22c55e'},
              {icon:'💰',label:'Vendas 6m (R$)',    value:fmtR(kpis.vendas_6m),                            cor:'#22c55e'},
              {icon:'📈',label:'Lucro 6m',          value:fmtR(kpis.lucro_6m),                             cor:'#a855f7'},
              {icon:'📉',label:'Margem',            value:fmtM(Number(kpis.lucro_6m)/Number(kpis.vendas_6m||1)*100), cor:'#C8102E'},
            ].map(k=>(
              <div key={k.label} style={{background:'#161616',border:'1px solid #1e1e1e',
                borderTop:`2px solid ${k.cor}`,borderRadius:9,padding:'9px 11px'}}>
                <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>{k.icon} {k.label}</div>
                <div style={{fontSize:13,fontWeight:800,color:'#f0f0f0',fontFamily:'monospace'}}>{k.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabela */}
        <div style={{background:'#111',border:'1px solid #1a1a1a',borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'10px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #1a1a1a'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontFamily:'Bebas Neue',fontSize:18,letterSpacing:1.5,color:'#f0f0f0'}}>
                PRODUTOS {filialSel&&`· ${filialSel}`} {grupoSel&&`· ${grupoSel}`}
              </div>
              {loading&&<span style={{fontSize:11,color:'#555',animation:'pulse 1s infinite'}}>⟳ carregando...</span>}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:11,color:'#555'}}>{total.toLocaleString('pt-BR')} itens</span>
              <span style={{fontSize:10,color:'#333',background:'#1a1a1a',borderRadius:5,padding:'2px 8px'}}>
                clique na linha · Esc fecha detalhes
              </span>
            </div>
          </div>

          {loading&&rows.length===0 ? <div style={{padding:40}}><Loading/></div>
          : empty ? (
            <div style={{padding:'60px 40px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:14}}>📂</div>
              <div style={{fontFamily:'Bebas Neue',fontSize:22,color:'#f0f0f0',letterSpacing:2,marginBottom:8}}>NENHUM DADO IMPORTADO</div>
              <div style={{fontSize:12,color:'#666'}}>Importe <strong style={{color:'#f39c12'}}>atualizado_sql_todas_as_lojas_csv.csv</strong> em Banco &amp; Planilhas</div>
            </div>
          ) : (
            <>
              <div style={{overflowX:'auto',maxHeight:540,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr>
                      <th style={TH('filial')}      onClick={()=>handleSort('filial')}>Loja {sortKey==='filial'?(sortAsc?'↑':'↓'):'↕'}</th>
                      <th style={TH('referencia')}  onClick={()=>handleSort('referencia')}>Ref. {sortKey==='referencia'?(sortAsc?'↑':'↓'):'↕'}</th>
                      <th style={{...TH('desc'),cursor:'default',color:'#555'}}>Descrição</th>
                      <th style={TH('grupo')}       onClick={()=>handleSort('grupo')}>Grupo {sortKey==='grupo'?(sortAsc?'↑':'↓'):'↕'}</th>
                      <th style={{...TH('st'),textAlign:'center',cursor:'default',color:'#555'}}>Status</th>
                      {renderCols()}
                      <th style={TH('margem_pct_filial','right')} onClick={()=>handleSort('margem_pct_filial')}>
                        Margem {sortKey==='margem_pct_filial'?(sortAsc?'↑':'↓'):'↕'}
                      </th>
                      <th style={TH('cobertura_meses_filial','right')} onClick={()=>handleSort('cobertura_meses_filial')}>
                        Cobert. {sortKey==='cobertura_meses_filial'?(sortAsc?'↑':'↓'):'↕'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=>{
                      const mPct = Number(r.margem_pct_filial||0);
                      const corM = mPct>=50?'#22c55e':mPct>=30?'#f59e0b':mPct>0?'#C8102E':'#555';
                      const cob  = Number(r.cobertura_meses_filial||0);
                      const corC = cob<=1?'#C8102E':cob<=3?'#f59e0b':'#22c55e';
                      const isHov = hovRow===i;
                      return (
                        <tr key={i}
                          style={{borderBottom:'1px solid #161616',cursor:'pointer',
                            background: isHov?'rgba(200,16,46,.07)':i%2===0?'transparent':'rgba(255,255,255,.01)',
                            transition:'background .08s'}}
                          onClick={()=>setDrawer(r)}
                          onMouseEnter={()=>setHovRow(i)}
                          onMouseLeave={()=>setHovRow(null)}>
                          <td style={TD}>
                            <span style={{background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.22)',
                              borderRadius:4,padding:'2px 7px',fontWeight:700,color:'#f59e0b',fontSize:10}}>
                              {r.filial}
                            </span>
                          </td>
                          <td style={{...TD,fontFamily:'monospace',fontSize:10,color:'#555'}}>{r.referencia}</td>
                          <td style={{...TD,maxWidth:190,overflow:'hidden',textOverflow:'ellipsis',color:'#ddd'}} title={r.descricao}>{r.descricao}</td>
                          <td style={{...TD,fontWeight:700,color:'#aaa'}}>{r.grupo}</td>
                          <td style={{...TD,textAlign:'center'}}><SBadge s={r.status_cobertura_filial}/></td>
                          {renderCells(r)}
                          <td style={{...TD,fontWeight:700,color:corM,textAlign:'right'}}>{mPct>0?fmtM(mPct):'—'}</td>
                          <td style={{...TD,color:corC,textAlign:'right'}}>{cob>0?cob.toFixed(1)+'m':'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'10px 16px',borderTop:'1px solid #1a1a1a',fontSize:11,color:'#666'}}>
                <span>
                  {(page*LIMIT+1).toLocaleString('pt-BR')}–{Math.min((page+1)*LIMIT,total).toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} itens
                  {loading&&<span style={{marginLeft:8,color:'#444'}}>· atualizando...</span>}
                </span>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <button onClick={()=>setPage(0)} disabled={page===0} style={PG(page===0)}>«</button>
                  <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={PG(page===0)}>‹</button>
                  <span style={{padding:'0 8px',color:'#555'}}>Pág. {page+1} / {Math.ceil(total/LIMIT)||1}</span>
                  <button onClick={()=>setPage(p=>p+1)} disabled={(page+1)*LIMIT>=total} style={PG((page+1)*LIMIT>=total)}>›</button>
                  <button onClick={()=>setPage(Math.ceil(total/LIMIT)-1)} disabled={(page+1)*LIMIT>=total} style={PG((page+1)*LIMIT>=total)}>»</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const PG = (dis) => ({
  background:'#161616', border:'1px solid #2a2a2a', borderRadius:6,
  padding:'5px 10px', color:dis?'#333':'#aaa', fontSize:13,
  cursor:dis?'not-allowed':'pointer', opacity:dis?.5:1,
});
