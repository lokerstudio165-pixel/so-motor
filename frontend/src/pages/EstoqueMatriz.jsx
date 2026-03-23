// src/pages/EstoqueMatriz.jsx — 100% interativo
import { useState, useRef, useCallback, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import { Loading } from '../components/UI';

const fmt    = (n,d=0) => n==null||isNaN(n)||n===''?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtR   = (n) => { if(n==null||isNaN(n)||n==='') return '—'; const v=Number(n); if(v>=1e6) return 'R$'+fmt(v/1e6,2)+'M'; if(v>=1e3) return 'R$'+fmt(v/1e3,1)+'K'; return 'R$'+fmt(v,0); };
const fmtFull= (n) => n==null||isNaN(n)||n===''?'—':'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtM   = (n) => n==null||isNaN(n)||n===''?'—':fmt(n,1)+'%';

const MESES_CD = ['Ago/25','Set/25','Out/25','Nov/25','Dez/25','Jan/26'];
const COB_COR  = {CRITICO:'#C8102E',EXCESSO:'#f59e0b',ADEQUADO:'#22c55e','SEM ESTOQUE':'#6b7280',BAIXO:'#f97316','SEM VENDA':'#334155'};

function CobBadge({ s }) {
  const c=COB_COR[s]||'#555';
  return <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontWeight:700,background:`${c}18`,border:`1px solid ${c}33`,color:c}}>{s||'—'}</span>;
}

// ─── KPI Card clicável ────────────────────────────────────────
function KpiCard({ icon, label, value, sub, cor, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={onClick}
      style={{
        background: hov&&onClick ? '#1c1c1c' : '#161616',
        border: `1px solid ${hov&&onClick ? cor+'44' : '#1e1e1e'}`,
        borderTop: `2px solid ${cor}`,
        borderRadius:9, padding:'11px 13px',
        cursor: onClick ? 'pointer' : 'default',
        transition:'all .15s',
        transform: hov&&onClick ? 'translateY(-1px)' : 'none',
        boxShadow: hov&&onClick ? `0 4px 14px ${cor}18` : 'none',
      }}>
      <div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>{icon} {label}</div>
      <div style={{fontSize:16,fontWeight:800,color:'#f0f0f0',fontFamily:'monospace'}}>{value}</div>
      {sub&&<div style={{fontSize:9,color:'#444',marginTop:3}}>{sub}</div>}
    </div>
  );
}

// ─── Gráfico sparkline de histórico mensal ───────────────────
function HistoricoMensal({ vlrs, qtds, meses }) {
  const [modo,  setModo]  = useState('vlr');
  const [hovI,  setHovI]  = useState(null);
  const vals  = modo==='vlr' ? vlrs : qtds;
  const maxV  = Math.max(...vals, 1);

  return (
    <div style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:10,padding:'14px 16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1}}>
          📅 Saídas CD — {meses[0]} → {meses[meses.length-1]}
        </div>
        <div style={{display:'flex',gap:4}}>
          {[{k:'vlr',l:'Valor'},{k:'qtd',l:'Quantidade'}].map(m=>(
            <button key={m.k} onClick={()=>setModo(m.k)}
              style={{fontSize:9,padding:'3px 8px',borderRadius:5,fontWeight:700,cursor:'pointer',
                background:modo===m.k?'rgba(59,130,246,.2)':'transparent',
                border:`1px solid ${modo===m.k?'rgba(59,130,246,.5)':'#2a2a2a'}`,
                color:modo===m.k?'#3b82f6':'#555'}}>
              {m.l}
            </button>
          ))}
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {meses.map((mes,i)=>{
          const val  = vals[i]||0;
          const pct  = (val/maxV*100).toFixed(1);
          const isL  = i===meses.length-1;
          const isH  = hovI===i;
          return (
            <div key={mes}
              onMouseEnter={()=>setHovI(i)} onMouseLeave={()=>setHovI(null)}
              style={{cursor:'default'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:11,color:isL?'#3b82f6':isH?'#aaa':'#666',fontWeight:isL||isH?700:400,transition:'color .12s'}}>{mes}</span>
                <div style={{display:'flex',gap:12}}>
                  {modo==='vlr'
                    ? <>
                        <span style={{fontSize:10,color:'#444'}}>{qtds[i]>0?fmt(qtds[i],0)+' un':''}</span>
                        <span style={{fontSize:11,fontFamily:'monospace',color:isL?'#f0f0f0':isH?'#bbb':'#888',fontWeight:isL||isH?700:400,transition:'all .12s'}}>
                          {val>0?fmtFull(val):'—'}
                        </span>
                      </>
                    : <span style={{fontSize:11,fontFamily:'monospace',color:isL?'#f0f0f0':isH?'#bbb':'#888',fontWeight:isL||isH?700:400,transition:'all .12s'}}>
                        {val>0?fmt(val,0)+' un':'—'}
                      </span>
                  }
                </div>
              </div>
              <div style={{height:8,background:'#1a1a1a',borderRadius:3,overflow:'hidden'}}>
                <div style={{
                  height:'100%', width:`${pct}%`,
                  background: isH ? '#fff' : isL ? '#3b82f6' : '#2a3a5a',
                  borderRadius:3, transition:'width .4s ease, background .12s',
                }}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Drawer de detalhes do item CD ───────────────────────────
function MatrizDrawer({ row, onClose }) {
  if (!row) return null;
  const vlrs = [row.vlr_ago25,row.vlr_set25,row.vlr_out25,row.vlr_nov25,row.vlr_dez25,row.vlr_jan26].map(Number);
  const qtds = [row.qtd_ago25,row.qtd_set25,row.qtd_out25,row.qtd_nov25,row.qtd_dez25,row.qtd_jan26].map(Number);
  const mPct = Number(row.margem_pct||0);
  const dias = Number(row.dias_sem_compra||0);

  return (
    <div style={{position:'fixed',inset:0,zIndex:9000,display:'flex',justifyContent:'flex-end'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'rgba(0,0,0,.65)',position:'absolute',inset:0}} onClick={onClose}/>
      <div style={{position:'relative',width:500,background:'#0d0d0d',borderLeft:'1px solid #1e1e1e',
        height:'100%',overflowY:'auto',zIndex:1,display:'flex',flexDirection:'column'}}>

        {/* Header fixo */}
        <div style={{padding:'18px 22px',borderBottom:'1px solid #1a1a1a',background:'#161616',
          position:'sticky',top:0,zIndex:2,flexShrink:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:'monospace',fontSize:11,color:'#444',marginBottom:3}}>{row.referencia}</div>
              <div style={{fontWeight:800,fontSize:15,color:'#fff',lineHeight:1.3,paddingRight:12}}>{row.descricao}</div>
            </div>
            <button onClick={onClose} style={{background:'#1f1f1f',border:'1px solid #2a2a2a',
              borderRadius:8,padding:'6px 12px',color:'#666',cursor:'pointer',fontSize:18,flexShrink:0}}>✕</button>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <span style={{background:'#1f1f1f',border:'1px solid #2a2a2a',borderRadius:5,
              padding:'3px 10px',color:'#888',fontSize:11}}>{row.grupo}{row.sub_grupo?` › ${row.sub_grupo}`:''}</span>
            <CobBadge s={row.status_cobertura}/>
            <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,fontWeight:700,
              background:row.status_produto==='EXISTENTE'?'rgba(46,204,138,.12)':'rgba(200,16,46,.12)',
              border:`1px solid ${row.status_produto==='EXISTENTE'?'#2ecc8a44':'#C8102E44'}`,
              color:row.status_produto==='EXISTENTE'?'#2ecc8a':'#C8102E'}}>{row.status_produto||'—'}</span>
          </div>
        </div>

        <div style={{padding:'18px 22px',display:'flex',flexDirection:'column',gap:14}}>

          {/* KPIs */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {[
              {l:'Saldo CD',         v:fmt(row.saldo_estoque_cd)+' un.', c:'#60a5fa'},
              {l:'Valor Estoque CD', v:fmtFull(row.valor_estoque_cd),    c:'#f59e0b'},
              {l:'Saídas CD 6m',     v:fmtFull(row.vlr_total_saida_cd_6m),c:'#22c55e'},
              {l:'Comprado 6m',      v:fmtFull(row.vlr_comprado_6m),     c:'#a855f7'},
              {l:'Margem %',         v:fmtM(mPct),                       c:mPct>10?'#22c55e':mPct>5?'#f59e0b':'#C8102E'},
              {l:'Lucro bruto 6m',   v:fmtFull(row.lucro_bruto_6m),      c:'#14b8a6'},
            ].map(k=>(
              <div key={k.l} style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:9,color:'#444',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>{k.l}</div>
                <div style={{fontFamily:'monospace',fontSize:14,fontWeight:700,color:k.c}}>{k.v}</div>
              </div>
            ))}
          </div>

          {/* Alerta dias sem compra */}
          {dias > 60 && (
            <div style={{background:`rgba(200,16,46,.08)`,border:'1px solid rgba(200,16,46,.25)',
              borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>⚠️</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:'#C8102E'}}>Sem compra há {fmt(dias)} dias</div>
                <div style={{fontSize:10,color:'#888',marginTop:2}}>Verifique disponibilidade no fornecedor</div>
              </div>
            </div>
          )}

          {/* Cobertura e Giro */}
          <div style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>📊 Cobertura e Giro</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {[
                {l:'Cobertura',         v:row.cobertura_meses_cd!=null?Number(row.cobertura_meses_cd).toFixed(1)+'m ('+fmt(row.cobertura_dias_cd)+' dias)':'—'},
                {l:'Giro estoque CD',   v:fmt(row.giro_estoque_cd,2)+'x'},
                {l:'Média mensal qtd',  v:fmt(row.media_mensal_qtd_cd,1)+' un.'},
                {l:'Preço médio saída', v:fmtFull(row.preco_medio_saida)},
                {l:'Meses com saída',   v:fmt(row.meses_com_saida_cd)+' meses'},
                {l:'Dias sem compra',   v:fmt(row.dias_sem_compra)+' dias', cor:dias>90?'#C8102E':dias>60?'#f59e0b':'#22c55e'},
              ].map(d=>(
                <div key={d.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #1a1a1a'}}>
                  <span style={{fontSize:11,color:'#555'}}>{d.l}</span>
                  <span style={{fontSize:11,fontFamily:'monospace',color:d.cor||'#ccc',fontWeight:600}}>{d.v||'—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Compras */}
          <div style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:10,padding:'14px 16px'}}>
            <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>🛒 Histórico de Compras</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {[
                {l:'Fornecedor',          v:row.fornecedor_ult},
                {l:'Última compra',       v:row.dt_ult_compra?new Date(row.dt_ult_compra).toLocaleDateString('pt-BR'):'—'},
                {l:'Valor ult. compra',   v:fmtFull(row.vlr_ult_compra)},
                {l:'Qtd. ult. compra',    v:fmt(row.qtd_ult_compra)+' un.'},
                {l:'Custo médio 6m',      v:fmtFull(row.custo_medio_compra_6m)},
                {l:'Notas 6m',            v:fmt(row.qtd_notas_6m)},
                {l:'Variação vs média',   v:fmtM(row.variacao_ult_vs_media_pct),
                  cor:Number(row.variacao_ult_vs_media_pct)<0?'#C8102E':'#22c55e'},
              ].map(d=>(
                <div key={d.l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid #1a1a1a'}}>
                  <span style={{fontSize:11,color:'#555'}}>{d.l}</span>
                  <span style={{fontSize:11,fontFamily:'monospace',color:d.cor||'#ccc',fontWeight:600}}>{d.v||'—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico mensal interativo */}
          <HistoricoMensal vlrs={vlrs} qtds={qtds} meses={MESES_CD}/>
        </div>
      </div>
    </div>
  );
}

// ─── Cabeçalho de coluna ordenável ───────────────────────────
function ThCol({ label, k, curr, asc, onSort, allow, align='left' }) {
  const act = curr===k && allow;
  return (
    <th onClick={()=>allow&&onSort(k)} style={{
      background:'#141414', textAlign:align, fontSize:10, textTransform:'uppercase',
      letterSpacing:.8, color:act?'#3b82f6':'#555', padding:'9px 10px',
      borderBottom:'1px solid #1e1e1e', fontWeight:600, whiteSpace:'nowrap',
      cursor:allow?'pointer':'default', userSelect:'none',
      position:'sticky', top:0, zIndex:2, transition:'color .12s',
    }}>
      {label} {allow ? (act?(asc?'↑':'↓'):<span style={{color:'#2a2a2a'}}>↕</span>) : ''}
    </th>
  );
}

const SORT_ALLOW = new Set(['referencia','grupo','saldo_estoque_cd','valor_estoque_cd',
  'vlr_total_saida_cd_6m','vlr_comprado_6m','margem_pct','lucro_bruto_6m','dias_sem_compra','cobertura_meses_cd']);

const STATUS_OPTS = ['CRITICO','SEM ESTOQUE','ADEQUADO','EXCESSO','BAIXO','SEM VENDA'];

export default function EstoqueMatriz() {
  const [rows,      setRows]      = useState([]);
  const [total,     setTotal]     = useState(0);
  const [kpis,      setKpis]      = useState(null);
  const [grupos,    setGrupos]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [page,      setPage]      = useState(0);
  const [search,    setSearch]    = useState('');
  const [grupo,     setGrupo]     = useState('');
  const [statusFil, setStatusFil] = useState('');
  const [sortKey,   setSortKey]   = useState('vlr_total_saida_cd_6m');
  const [sortAsc,   setSortAsc]   = useState(false);
  const [drawer,    setDrawer]    = useState(null);
  const [hovRow,    setHovRow]    = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importMode,setImportMode]= useState('substituir');
  const [showImport,setShowImport]= useState(false);
  const fileRef  = useRef(null);
  const searchRef= useRef(null);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {data} = await api.get('/database/estoque-matriz', {
        params:{limit:LIMIT,offset:page*LIMIT,search:search||undefined,grupo:grupo||undefined}
      });
      let sorted = [...(data.rows||[])];
      if (SORT_ALLOW.has(sortKey)) {
        sorted.sort((a,b)=>{
          const va=isNaN(Number(a[sortKey]))?String(a[sortKey]||''):Number(a[sortKey]||0);
          const vb=isNaN(Number(b[sortKey]))?String(b[sortKey]||''):Number(b[sortKey]||0);
          if(typeof va==='string') return sortAsc?va.localeCompare(vb):vb.localeCompare(va);
          return sortAsc?va-vb:vb-va;
        });
      }
      // filtro de status no cliente
      if (statusFil) sorted = sorted.filter(r=>r.status_cobertura===statusFil);
      setRows(sorted); setTotal(data.total); setKpis(data.kpis); setGrupos(data.grupos||[]);
    } catch(e){ console.error(e); }
    finally{ setLoading(false); }
  },[page,search,grupo,sortKey,sortAsc,statusFil]);

  useEffect(()=>{ load(); },[load]);

  useEffect(()=>{
    const fn = e=>{
      if(e.key==='Escape'){setDrawer(null);setStatusFil('');}
      if(e.key==='/'&&!drawer&&document.activeElement!==searchRef.current){e.preventDefault();searchRef.current?.focus();}
    };
    window.addEventListener('keydown',fn);
    return()=>window.removeEventListener('keydown',fn);
  },[drawer]);

  function handleSort(k){ if(!SORT_ALLOW.has(k)) return; if(sortKey===k) setSortAsc(a=>!a); else{setSortKey(k);setSortAsc(false);} setPage(0); }

  async function handleFile(file) {
    if(!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    setImporting(true); setImportMsg('');
    try {
      let dadosBrutos = [];
      if(ext==='xlsx'||ext==='xls'){
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf,{type:'array',cellDates:true,raw:false});
        dadosBrutos = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:null,raw:false,dateNF:'yyyy-mm-dd'});
      } else if(ext==='csv'){
        const text = await file.text();
        const sep  = text.slice(0,500).split(';').length>=text.slice(0,500).split(',').length?';':',';
        const lines= text.split(/\r?\n/).filter(l=>l.trim());
        const hdrs = lines[0].split(sep).map(h=>h.replace(/^"|"$/g,'').trim());
        dadosBrutos= lines.slice(1).map(line=>{const vs=line.split(sep).map(v=>v.replace(/^"|"$/g,'').trim());const o={};hdrs.forEach((h,i)=>{o[h]=vs[i]??null;});return o;});
      } else throw new Error('Use .xlsx, .xls ou .csv');
      if(!dadosBrutos.length) throw new Error('Arquivo vazio.');
      const LOTE=1000; let totalIns=0;
      for(let i=0;i<dadosBrutos.length;i+=LOTE){
        const lote = dadosBrutos.slice(i,i+LOTE);
        setImportMsg(`⏳ ${Math.min(i+LOTE,dadosBrutos.length).toLocaleString()} / ${dadosBrutos.length.toLocaleString()}`);
        const {data} = await api.post('/database/importar-matriz',{dados:lote,modo:i===0?importMode:'acumular'});
        totalIns += data.inserted||lote.length;
      }
      setImportMsg(`✅ ${totalIns.toLocaleString()} registros importados!`);
      setShowImport(false); load();
    } catch(e){ setImportMsg(`❌ ${e.response?.data?.error||e.message}`); }
    finally{ setImporting(false); if(fileRef.current) fileRef.current.value=''; setTimeout(()=>setImportMsg(''),12000); }
  }

  const empty = !loading&&total===0&&!search&&!grupo;
  const temFiltro = search||grupo||statusFil;

  return (
    <>
      {drawer&&<MatrizDrawer row={drawer} onClose={()=>setDrawer(null)}/>}
      <div style={{padding:'16px 24px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:10}}>
          <div>
            <h1 style={{fontFamily:'Bebas Neue',fontSize:26,letterSpacing:2,color:'#f0f0f0',margin:0}}>
              ESTOQUE MATRIZ — CD
            </h1>
            <div style={{fontSize:11,color:'#555',marginTop:2}}>
              Centro de Distribuição · {fmt(total)} itens
              {loading&&<span style={{marginLeft:8,color:'#3b82f6'}}>⟳ atualizando...</span>}
            </div>
          </div>
          <button onClick={()=>setShowImport(v=>!v)}
            style={{background:showImport?'rgba(59,130,246,.25)':'rgba(59,130,246,.14)',
              border:'1px solid rgba(59,130,246,.4)',borderRadius:8,
              padding:'8px 18px',color:'#3b82f6',fontSize:12,fontWeight:700,cursor:'pointer',
              transition:'all .14s'}}>
            📥 {showImport?'Fechar':'Importar NSD Excel'}
          </button>
        </div>

        {/* Painel de importação */}
        {showImport&&(
          <div style={{background:'rgba(59,130,246,.05)',border:'1px solid rgba(59,130,246,.22)',borderRadius:12,padding:18}}>
            <div style={{fontWeight:700,fontSize:13,color:'#3b82f6',marginBottom:10}}>📥 nsd_sql_compra_final.xlsx</div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              {['substituir','acumular'].map(m=>(
                <button key={m} onClick={()=>setImportMode(m)}
                  style={{padding:'7px 16px',fontSize:12,fontWeight:700,borderRadius:8,border:'none',cursor:'pointer',
                    background:importMode===m?(m==='substituir'?'#C8102E':'#22c55e'):'#1f1f1f',
                    color:importMode===m?'#fff':'#666',transition:'all .14s'}}>
                  {m==='substituir'?'🔄 Substituir tudo':'➕ Acumular'}
                </button>
              ))}
              <button onClick={()=>fileRef.current?.click()} disabled={importing}
                style={{background:'#3b82f6',border:'none',borderRadius:8,padding:'8px 20px',
                  color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',opacity:importing?.6:1}}>
                {importing?'⏳ Importando...':'📂 Selecionar arquivo'}
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}}
                onChange={e=>handleFile(e.target.files[0])}/>
            </div>
            {importMsg&&(
              <div style={{marginTop:10,fontSize:12,padding:'8px 12px',borderRadius:7,
                background:importMsg.startsWith('✅')?'rgba(34,197,94,.1)':importMsg.startsWith('❌')?'rgba(200,16,46,.1)':'rgba(245,158,11,.1)',
                color:importMsg.startsWith('✅')?'#22c55e':importMsg.startsWith('❌')?'#C8102E':'#f59e0b'}}>
                {importMsg}
              </div>
            )}
          </div>
        )}

        {/* KPIs clicáveis */}
        {kpis&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8}}>
            <KpiCard icon='📦' label='Itens CD'          value={fmt(kpis.total_itens)}   cor='#3b82f6'/>
            <KpiCard icon='🔢' label='Total Peças'        value={fmt(kpis.total_pecas)}   cor='#60a5fa'/>
            <KpiCard icon='💼' label='Valor Estoque CD'   value={fmtR(kpis.valor_total)}  cor='#f59e0b'/>
            <KpiCard icon='🚚' label='Saídas CD 6m'       value={fmtR(kpis.saida_6m)}     cor='#22c55e'/>
            <KpiCard icon='🛒' label='Comprado 6m'        value={fmtR(kpis.comprado_6m)}  cor='#a855f7'/>
            <KpiCard icon='📈' label='Lucro estimado'     value={fmtR(Number(kpis.saida_6m)*0.056)} cor='#14b8a6'/>
            <KpiCard icon='📅' label='Dias médio s/compra' value={fmt(kpis.media_dias_sem_compra)+'d'} cor='#f97316'/>
          </div>
        )}

        {/* Filtros */}
        <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center',
          background:'#111',border:'1px solid #1a1a1a',borderRadius:9,padding:'9px 14px'}}>
          <input ref={searchRef} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}
            placeholder="🔍 Buscar referência ou descrição... (/)"
            style={{background:'#161616',border:'1px solid #2a2a2a',borderRadius:7,
              padding:'6px 12px',color:'#f0f0f0',fontSize:11,width:280,
              outline:'none',transition:'border .13s'}}
            onFocus={e=>e.target.style.borderColor='#3b82f6'}
            onBlur={e=>e.target.style.borderColor='#2a2a2a'}/>

          {/* Status chips */}
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {STATUS_OPTS.map(s=>{
              const c = COB_COR[s]||'#555';
              const on = statusFil===s;
              return (
                <button key={s} onClick={()=>{setStatusFil(v=>v===s?'':s);setPage(0);}}
                  style={{fontSize:10,padding:'4px 10px',borderRadius:20,fontWeight:700,cursor:'pointer',
                    background:on?c:`${c}14`,border:`1px solid ${c}${on?'':'33'}`,
                    color:on?'#fff':c,transition:'all .14s'}}>
                  {s}
                </button>
              );
            })}
          </div>

          {temFiltro&&(
            <button onClick={()=>{setSearch('');setGrupo('');setStatusFil('');setPage(0);}}
              style={{background:'rgba(200,16,46,.1)',border:'1px solid rgba(200,16,46,.3)',
                borderRadius:7,padding:'5px 12px',color:'#C8102E',fontSize:11,fontWeight:700,cursor:'pointer'}}>
              ✕ Limpar
            </button>
          )}
        </div>

        {/* Chips de grupo */}
        {grupos.length>0&&(
          <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
            <span style={{fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:1}}>Grupo:</span>
            <button onClick={()=>{setGrupo('');setPage(0);}}
              style={{fontSize:10,padding:'3px 11px',borderRadius:20,fontWeight:700,cursor:'pointer',
                background:!grupo?'rgba(59,130,246,.18)':'transparent',
                border:`1px solid ${!grupo?'rgba(59,130,246,.5)':'#222'}`,
                color:!grupo?'#3b82f6':'#555',transition:'all .13s'}}>
              Todos
            </button>
            {grupos.slice(0,18).map(g=>(
              <button key={g.grupo} onClick={()=>{setGrupo(v=>v===g.grupo?'':g.grupo);setPage(0);}}
                style={{fontSize:10,padding:'3px 11px',borderRadius:20,fontWeight:700,cursor:'pointer',
                  background:grupo===g.grupo?'rgba(59,130,246,.18)':'transparent',
                  border:`1px solid ${grupo===g.grupo?'rgba(59,130,246,.5)':'#1e1e1e'}`,
                  color:grupo===g.grupo?'#3b82f6':'#555',transition:'all .13s'}}>
                {g.grupo}
              </button>
            ))}
          </div>
        )}

        {/* Ordenação por botões */}
        <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:1,marginRight:4}}>Ordenar:</span>
          {[
            {k:'vlr_total_saida_cd_6m',l:'Saídas 6m'},
            {k:'valor_estoque_cd',     l:'Estoque'},
            {k:'saldo_estoque_cd',     l:'Saldo'},
            {k:'vlr_comprado_6m',      l:'Comprado'},
            {k:'margem_pct',           l:'Margem'},
            {k:'lucro_bruto_6m',       l:'Lucro'},
            {k:'dias_sem_compra',      l:'Dias s/Compra'},
            {k:'cobertura_meses_cd',   l:'Cobertura'},
          ].map(o=>(
            <button key={o.k} onClick={()=>handleSort(o.k)}
              style={{fontSize:10,padding:'4px 10px',borderRadius:6,fontWeight:700,cursor:'pointer',
                background:sortKey===o.k?'rgba(59,130,246,.18)':'transparent',
                border:`1px solid ${sortKey===o.k?'rgba(59,130,246,.5)':'#222'}`,
                color:sortKey===o.k?'#3b82f6':'#555',transition:'all .13s'}}>
              {o.l} {sortKey===o.k?(sortAsc?'↑':'↓'):''}
            </button>
          ))}
        </div>

        {/* Tabela */}
        <div style={{background:'#111',border:'1px solid #1a1a1a',borderRadius:10,overflow:'hidden'}}>
          <div style={{padding:'10px 16px',display:'flex',justifyContent:'space-between',
            alignItems:'center',borderBottom:'1px solid #1a1a1a'}}>
            <div style={{fontFamily:'Bebas Neue',fontSize:18,letterSpacing:1.5,color:'#f0f0f0'}}>
              ESTOQUE CD {grupo&&`· ${grupo}`}{statusFil&&` · ${statusFil}`}
            </div>
            <span style={{fontSize:10,color:'#333',background:'#1a1a1a',borderRadius:5,padding:'2px 8px'}}>
              clique na linha para detalhes · Esc fecha
            </span>
          </div>

          {loading&&rows.length===0 ? <div style={{padding:40}}><Loading/></div>
          : empty ? (
            <div style={{padding:'60px 40px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:14}}>📂</div>
              <div style={{fontFamily:'Bebas Neue',fontSize:22,color:'#f0f0f0',letterSpacing:2,marginBottom:8}}>NENHUM DADO</div>
              <div style={{fontSize:12,color:'#666'}}>Importe <strong style={{color:'#f39c12'}}>nsd_sql_compra_final.xlsx</strong> acima</div>
            </div>
          ) : (
            <>
              <div style={{overflowX:'auto',maxHeight:520,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr>
                      <ThCol label="Referência"   k="referencia"          curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('referencia')}/>
                      <ThCol label="Descrição"    k="descricao"           curr={sortKey} asc={sortAsc} onSort={handleSort} allow={false}/>
                      <ThCol label="Grupo"        k="grupo"               curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('grupo')}/>
                      <ThCol label="Unidade"      k="unidade"             curr={sortKey} asc={sortAsc} onSort={handleSort} allow={false} align="center"/>
                      <ThCol label="Status"       k="status_cobertura"    curr={sortKey} asc={sortAsc} onSort={handleSort} allow={false} align="center"/>
                      <ThCol label="Saldo CD"     k="saldo_estoque_cd"    curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('saldo_estoque_cd')} align="right"/>
                      <ThCol label="Val.Est.CD"   k="valor_estoque_cd"    curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('valor_estoque_cd')} align="right"/>
                      <ThCol label="Saídas 6m"    k="vlr_total_saida_cd_6m" curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('vlr_total_saida_cd_6m')} align="right"/>
                      <ThCol label="Comprado 6m"  k="vlr_comprado_6m"     curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('vlr_comprado_6m')} align="right"/>
                      <ThCol label="Margem"       k="margem_pct"          curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('margem_pct')} align="right"/>
                      <ThCol label="Lucro 6m"     k="lucro_bruto_6m"      curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('lucro_bruto_6m')} align="right"/>
                      <ThCol label="Cobert."      k="cobertura_meses_cd"  curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('cobertura_meses_cd')} align="right"/>
                      <ThCol label="Dias s/Compra" k="dias_sem_compra"    curr={sortKey} asc={sortAsc} onSort={handleSort} allow={SORT_ALLOW.has('dias_sem_compra')} align="right"/>
                      <ThCol label="Fornecedor"   k="fornecedor_ult"      curr={sortKey} asc={sortAsc} onSort={handleSort} allow={false}/>
                      <ThCol label="Ult.Compra"   k="dt_ult_compra"       curr={sortKey} asc={sortAsc} onSort={handleSort} allow={false}/>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=>{
                      const mPct = Number(r.margem_pct||0);
                      const dias = Number(r.dias_sem_compra||0);
                      const cob  = Number(r.cobertura_meses_cd||0);
                      const isH  = hovRow===i;
                      return (
                        <tr key={r.id||i}
                          style={{borderBottom:'1px solid #161616',cursor:'pointer',
                            background:isH?'rgba(59,130,246,.06)':i%2===0?'transparent':'rgba(255,255,255,.01)',
                            transition:'background .08s'}}
                          onClick={()=>setDrawer(r)}
                          onMouseEnter={()=>setHovRow(i)} onMouseLeave={()=>setHovRow(null)}>
                          <td style={{...TD,color:'#3b82f6',fontWeight:700,fontFamily:'monospace'}}>{r.referencia}</td>
                          <td style={{...TD,maxWidth:190,overflow:'hidden',textOverflow:'ellipsis',color:'#ddd'}} title={r.descricao}>{r.descricao}</td>
                          <td style={{...TD,fontWeight:700,color:'#aaa'}}>{r.grupo}</td>
                          <td style={{...TD,textAlign:'center',color:'#888',fontSize:10,fontFamily:'monospace'}}>{r.unidade||'—'}</td>
                          <td style={{...TD,textAlign:'center'}}><CobBadge s={r.status_cobertura}/></td>
                          <td style={{...TD,fontFamily:'monospace',textAlign:'right',color:'#60a5fa',fontWeight:700}}>{fmt(r.saldo_estoque_cd)}</td>
                          <td style={{...TD,fontFamily:'monospace',textAlign:'right',color:'#f59e0b'}}>{fmtR(r.valor_estoque_cd)}</td>
                          <td style={{...TD,fontFamily:'monospace',textAlign:'right',fontWeight:700}}>{fmtR(r.vlr_total_saida_cd_6m)}</td>
                          <td style={{...TD,fontFamily:'monospace',textAlign:'right',color:'#a855f7'}}>{fmtR(r.vlr_comprado_6m)}</td>
                          <td style={{...TD,textAlign:'right',fontWeight:700,color:mPct>10?'#22c55e':mPct>5?'#f59e0b':'#C8102E'}}>{mPct>0?fmtM(mPct):'—'}</td>
                          <td style={{...TD,fontFamily:'monospace',textAlign:'right',color:'#14b8a6'}}>{fmtR(r.lucro_bruto_6m)}</td>
                          <td style={{...TD,textAlign:'right',color:cob>6?'#22c55e':cob>2?'#f59e0b':'#C8102E'}}>{cob>0?cob.toFixed(1)+'m':'—'}</td>
                          <td style={{...TD,textAlign:'right',color:dias>90?'#C8102E':dias>60?'#f59e0b':'#22c55e',fontWeight:700}}>{fmt(dias)}d</td>
                          <td style={{...TD,color:'#555',fontSize:10,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis'}}>{r.fornecedor_ult||'—'}</td>
                          <td style={{...TD,color:'#555'}}>{r.dt_ult_compra?new Date(r.dt_ult_compra).toLocaleDateString('pt-BR'):'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'10px 16px',borderTop:'1px solid #1a1a1a',fontSize:11,color:'#666'}}>
                <span>{(page*LIMIT+1).toLocaleString('pt-BR')}–{Math.min((page+1)*LIMIT,total).toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}</span>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  {[['«',0],['‹',Math.max(0,page-1)]].map(([l,p])=>(
                    <button key={l} onClick={()=>setPage(p)} disabled={page===0}
                      style={{...PG,opacity:page===0?.5:1,cursor:page===0?'not-allowed':'pointer',color:page===0?'#333':'#aaa'}}>{l}</button>
                  ))}
                  <span style={{padding:'0 8px',color:'#555'}}>Pág. {page+1} / {Math.ceil(total/LIMIT)||1}</span>
                  {[['›',page+1],['»',Math.ceil(total/LIMIT)-1]].map(([l,p])=>{
                    const dis=(page+1)*LIMIT>=total;
                    return(
                      <button key={l} onClick={()=>setPage(p)} disabled={dis}
                        style={{...PG,opacity:dis?.5:1,cursor:dis?'not-allowed':'pointer',color:dis?'#333':'#aaa'}}>{l}</button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const TD = {padding:'8px 10px',color:'#f0f0f0',whiteSpace:'nowrap'};
const PG = {background:'#161616',border:'1px solid #2a2a2a',borderRadius:6,padding:'5px 10px',fontSize:13};
