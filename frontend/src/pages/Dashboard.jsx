// src/pages/Dashboard.jsx — máxima interatividade
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Card, CardTitle, StatusBadge, Loading } from '../components/UI';

const fmt  = (n,d=0) => n==null||isNaN(n)||n===''?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtR = (n,suf='') => { if(n==null||isNaN(n)||n==='') return '—'; const v=Number(n); if(Math.abs(v)>=1e6) return 'R$'+fmt(v/1e6,1)+'M'+suf; if(Math.abs(v)>=1e3) return 'R$'+fmt(v/1e3,1)+'K'+suf; return 'R$'+fmt(v,0)+suf; };
const fmtM = n => n==null||isNaN(n)||n===''?'—':fmt(n,1)+'%';

const CORES_FILIAIS = ['#C8102E','#3b82f6','#22c55e','#f59e0b','#a855f7','#14b8a6','#f97316','#e63950','#60a5fa','#34d399','#fbbf24','#c084fc','#2dd4bf','#fb923c','#818cf8','#4ade80','#facc15','#f472b6'];
const CORES_STATUS  = { 'CRITICO':'#C8102E','SEM ESTOQUE':'#6b7280','EXCESSO':'#f59e0b','ADEQUADO':'#22c55e','BAIXO':'#f97316','SEM VENDA':'#334155' };

// ─── KPI Card animado ────────────────────────────────────────
function KPI({ icon, label, value, sub, cor='#C8102E', prog, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      onClick={onClick}
      style={{
        background: hov&&onClick?'#1c1c1c':'#161616',
        border:`1px solid ${hov&&onClick?cor+'44':'#1e1e1e'}`,
        borderRadius:10, padding:'14px 16px', position:'relative', overflow:'hidden',
        cursor:onClick?'pointer':'default',
        transition:'all .18s',
        transform: hov&&onClick?'translateY(-1px)':'none',
      }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${cor}, transparent)` }} />
      <div style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:1.2, marginBottom:6 }}>{icon} {label}</div>
      <div style={{ fontFamily:'Bebas Neue', fontSize:26, color:'#f0f0f0', lineHeight:1, letterSpacing:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:'#555', marginTop:4 }}>{sub}</div>}
      {prog !== undefined && (
        <div style={{ height:3, background:'#1a1a1a', borderRadius:2, marginTop:8, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${Math.min(prog,100)}%`, background:cor, borderRadius:2, transition:'width .6s ease' }} />
        </div>
      )}
    </div>
  );
}

// ─── Gráfico de linha SVG com tooltip e área ─────────────────
function LineChart({ data, valueKey='vendas', labelKey='mes', cor='#C8102E', height=130 }) {
  const [tip, setTip] = useState(null);
  if (!data?.length) return null;
  const vals = data.map(d => Number(d[valueKey])||0);
  const max  = Math.max(...vals, 1);
  const min  = 0;
  const W=420, H=height, PAD=28;
  const xs = vals.map((_,i) => PAD + (i/(vals.length-1||1))*(W-PAD*2));
  const ys = vals.map(v => PAD + (1-(v-min)/(max-min||1))*(H-PAD*2));
  const path = xs.map((x,i) => `${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = `${path} L${xs[xs.length-1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`;
  const gradId = `lg${cor.replace('#','')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height, overflow:'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={cor} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={cor} stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`}/>
      <path d={path} fill="none" stroke={cor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {xs.map((x,i) => {
        const isLast = i===vals.length-1;
        return (
          <g key={i} style={{cursor:'pointer'}}
            onMouseEnter={()=>setTip(i)} onMouseLeave={()=>setTip(null)}>
            {/* hit area */}
            <circle cx={x} cy={ys[i]} r={14} fill="transparent"/>
            <circle cx={x} cy={ys[i]} r={tip===i?5:isLast?4:3} fill={cor} style={{transition:'r .12s'}}/>
            {isLast && <circle cx={x} cy={ys[i]} r={8} fill={cor} fillOpacity="0.15"/>}
            <text x={x} y={H-3} textAnchor="middle" fontSize="9" fill="#444">{data[i][labelKey]}</text>
            {tip===i&&(
              <>
                <line x1={x} y1={ys[i]+6} x2={x} y2={H-14} stroke={cor} strokeWidth="1" strokeDasharray="3,2" strokeOpacity="0.3"/>
                <rect x={x-52} y={ys[i]-30} width={104} height={22} rx={5} fill="#1e1e1e" stroke={cor} strokeWidth="0.8" strokeOpacity="0.4"/>
                <text x={x} y={ys[i]-15} textAnchor="middle" fontSize="10" fill="#fff" fontFamily="monospace" fontWeight="700">{fmtR(vals[i])}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Gráfico de barras com tooltip ───────────────────────────
function BarChart({ data, valueKey, labelKey, colorFn, onClickItem, maxItems=10 }) {
  const [tip, setTip] = useState(null);
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map(d => Number(d[valueKey])||0), 1);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:8}}>
      {items.map((d,i) => {
        const val = Number(d[valueKey])||0;
        const pct = (val/max*100).toFixed(1);
        const cor = colorFn ? colorFn(d,i) : '#C8102E';
        return (
          <div key={i}
            style={{display:'flex',alignItems:'center',gap:8,cursor:onClickItem?'pointer':'default',position:'relative'}}
            onClick={()=>onClickItem&&onClickItem(d)}
            onMouseEnter={()=>setTip(i)} onMouseLeave={()=>setTip(null)}>
            <div style={{fontSize:11,fontWeight:600,width:54,flexShrink:0,
              color:tip===i?'#fff':'#888',overflow:'hidden',textOverflow:'ellipsis',
              whiteSpace:'nowrap',transition:'color .12s'}} title={d[labelKey]}>{d[labelKey]}</div>
            <div style={{flex:1,height:20,background:'#1a1a1a',borderRadius:4,overflow:'hidden'}}>
              <div style={{
                height:'100%', width:`${pct}%`, background:cor, borderRadius:4,
                display:'flex', alignItems:'center', paddingLeft:7,
                fontSize:9, fontWeight:700, color:'rgba(255,255,255,.85)',
                transition:'width .5s ease, opacity .12s',
                opacity:tip!==null&&tip!==i?.45:1,
              }}>
                {Number(pct)>22?fmtR(val):''}
              </div>
            </div>
            <div style={{fontSize:10,color:tip===i?'#fff':'#555',width:58,
              textAlign:'right',flexShrink:0,fontFamily:'monospace',transition:'color .12s'}}>{fmtR(val)}</div>
            {tip===i&&(
              <div style={{position:'absolute',right:68,top:-28,
                background:'#1e1e1e',border:`1px solid ${cor}55`,borderRadius:6,
                padding:'3px 10px',fontSize:10,color:'#fff',zIndex:10,whiteSpace:'nowrap',pointerEvents:'none'}}>
                {d[labelKey]}: {fmtR(val)}{onClickItem?' · clique':''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Donut interativo ────────────────────────────────────────
function Donut({ data, colors, center, sub, size=150 }) {
  const [hov, setHov] = useState(null);
  const total = data.reduce((a,d) => a+Number(d.value),0) || 1;
  let angle = -90;
  const R=56, cx=80, cy=80;
  const slices = data.filter(d=>d.value>0).map((d,i) => {
    const deg = (Number(d.value)/total)*360;
    const r1  = angle*(Math.PI/180);
    const r2  = (angle+deg)*(Math.PI/180);
    const x1=cx+R*Math.cos(r1), y1=cy+R*Math.sin(r1);
    const x2=cx+R*Math.cos(r2), y2=cy+R*Math.sin(r2);
    const large = deg>180?1:0;
    const path  = `M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} Z`;
    angle += deg;
    return { path, color:colors[i%colors.length], label:d.name, value:d.value, pct:(d.value/total*100).toFixed(1) };
  });
  const hovSlice = hov!==null ? slices[hov] : null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
      <svg viewBox="0 0 160 160" style={{ width:size, height:size, flexShrink:0 }}>
        {slices.map((s,i) => (
          <path key={i} d={s.path} fill={s.color}
            opacity={hov===null?0.9:hov===i?1:0.35}
            style={{cursor:'pointer',transition:'opacity .15s'}}
            onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}/>
        ))}
        <circle cx={cx} cy={cy} r={34} fill="#161616"/>
        {hovSlice ? (
          <>
            <text x={cx} y={cy-5} textAnchor="middle" fontSize="12" fontWeight="700" fill={hovSlice.color} fontFamily="monospace">{fmt(hovSlice.value)}</text>
            <text x={cx} y={cy+9} textAnchor="middle" fontSize="9" fill={hovSlice.color}>{hovSlice.pct}%</text>
          </>
        ) : (
          <>
            <text x={cx} y={cy-4} textAnchor="middle" fontSize="15" fontWeight="700" fill="#f0f0f0" fontFamily="monospace">{center}</text>
            <text x={cx} y={cy+11} textAnchor="middle" fontSize="9" fill="#555">{sub}</text>
          </>
        )}
      </svg>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {slices.map((s,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer',
            opacity:hov===null?1:hov===i?1:0.4, transition:'opacity .15s' }}
            onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:s.color, flexShrink:0 }}/>
            <span style={{ fontSize:10, color:'#888' }}>{s.label}</span>
            <span style={{ fontSize:10, color:'#444', marginLeft:'auto', fontFamily:'monospace', paddingLeft:10 }}>{fmt(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Performance por Loja — widget BASTO ─────────────────────
function PerformanceLojas({ filiaisLista, filialSel, setFilialSel, setLojaModal, totalVendas6m }) {
  const [hovId,  setHovId]  = useState(null);
  const [metrica,setMetrica]= useState('vendas_6m');

  const METRICAS = [
    { key:'vendas_6m',     label:'Vendas 6M',  cor:'#C8102E' },
    { key:'vendas_mes',    label:'Vendas Mês', cor:'#14b8a6' },
    { key:'lucro_6m',      label:'Lucro 6M',   cor:'#a855f7' },
    { key:'valor_estoque', label:'Estoque',    cor:'#f59e0b' },
  ];
  const met = METRICAS.find(m=>m.key===metrica);
  const maxV = Math.max(...filiaisLista.map(f=>Number(f[metrica])||0),1);

  const totVendas = filiaisLista.reduce((a,f)=>a+Number(f.vendas_6m||0),0);
  const totMes    = filiaisLista.reduce((a,f)=>a+Number(f.vendas_mes||0),0);
  const totLucro  = filiaisLista.reduce((a,f)=>a+Number(f.lucro_6m||0),0);
  const margemG   = totVendas>0?(totLucro/totVendas*100).toFixed(1):0;

  return (
    <div style={{background:'#161616',border:'1px solid #1e1e1e',borderRadius:10,overflow:'hidden'}}>
      <div style={{background:'linear-gradient(135deg,#1a0005 0%,#161616 60%)',borderBottom:'1px solid #1e1e1e',
        padding:'13px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1.5,color:'#888',marginBottom:4}}>
            🏪 Performance por Loja
          </div>
          <div style={{display:'flex',gap:18}}>
            {[
              {v:fmtR(totVendas), l:'vendas 6M', c:'#22c55e'},
              {v:fmtR(totMes),    l:'este mês',  c:'#14b8a6'},
              {v:margemG+'%',     l:'margem',    c:'#a855f7'},
              {v:filiaisLista.length, l:'lojas', c:'#f0f0f0'},
            ].map(s=>(
              <span key={s.l} style={{fontSize:11,color:'#555'}}>
                <span style={{color:s.c,fontWeight:700,fontFamily:'monospace'}}>{s.v}</span>
                <span style={{marginLeft:4}}>{s.l}</span>
              </span>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:4}}>
          {METRICAS.map(m=>(
            <button key={m.key} onClick={()=>setMetrica(m.key)}
              style={{background:metrica===m.key?`${m.cor}20`:'transparent',
                border:`1px solid ${metrica===m.key?m.cor+'60':'#222'}`,
                borderRadius:5,padding:'4px 10px',color:metrica===m.key?m.cor:'#555',
                fontSize:10,fontWeight:700,cursor:'pointer',transition:'all .15s'}}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cabeçalho colunas */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 18px 3px',borderBottom:'1px solid #1a1a1a'}}>
        <div style={{width:16,flexShrink:0}}/>
        <div style={{width:36,flexShrink:0,fontSize:9,color:'#333',textTransform:'uppercase',letterSpacing:1}}>Loja</div>
        <div style={{flex:1,fontSize:9,color:'#333',textTransform:'uppercase',letterSpacing:1}}>{met.label}</div>
        <div style={{width:44,textAlign:'right',flexShrink:0,fontSize:9,color:'#333',textTransform:'uppercase',letterSpacing:1}}>Margem</div>
        <div style={{width:34,textAlign:'right',flexShrink:0,fontSize:9,color:'#333',textTransform:'uppercase',letterSpacing:1}}>Share</div>
        <div style={{width:8,flexShrink:0}}/>
      </div>

      <div style={{padding:'5px 10px 10px'}}>
        {filiaisLista.map((f,i) => {
          const val   = Number(f[metrica])||0;
          const pct   = (val/maxV*100).toFixed(1);
          const share = totVendas>0?(Number(f.vendas_6m||0)/totVendas*100).toFixed(1):0;
          const marg  = Number(f.margem_real)||0;
          const isHov = hovId===f.filial;
          const isSel = filialSel===f.filial;
          const corF  = CORES_FILIAIS[i%CORES_FILIAIS.length];
          const barCor= isSel?corF:met.cor;

          return (
            <div key={f.filial}
              onClick={()=>setFilialSel(s=>s===f.filial?'Todas':f.filial)}
              onDoubleClick={e=>{e.stopPropagation();setLojaModal(f);}}
              onMouseEnter={()=>setHovId(f.filial)}
              onMouseLeave={()=>setHovId(null)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'5px 8px',borderRadius:7,
                cursor:'pointer',marginBottom:2,
                background:isSel?`${corF}12`:isHov?'rgba(255,255,255,.02)':'transparent',
                border:`1px solid ${isSel?corF+'30':'transparent'}`,
                transition:'all .15s'}}>
              <div style={{fontSize:10,fontWeight:700,color:i<3?'#444':'#252525',width:16,textAlign:'center',flexShrink:0}}>{i+1}</div>
              <div style={{fontSize:12,fontWeight:700,color:isSel?'#fff':isHov?'#ddd':'#999',
                width:36,flexShrink:0,transition:'color .15s'}}>{f.filial}</div>
              <div style={{flex:1,height:22,background:'#1a1a1a',borderRadius:4,overflow:'hidden',position:'relative'}}>
                <div style={{height:'100%',width:`${pct}%`,
                  background:isHov||isSel?`linear-gradient(90deg,${barCor}ee,${barCor}88)`:`linear-gradient(90deg,${barCor}cc,${barCor}55)`,
                  borderRadius:4,transition:'width .5s ease, background .18s',
                  display:'flex',alignItems:'center',paddingLeft:8}}>
                  {Number(pct)>22&&(
                    <span style={{fontSize:10,fontWeight:700,color:'rgba(255,255,255,.88)',whiteSpace:'nowrap'}}>{fmtR(val)}</span>
                  )}
                </div>
                {Number(pct)<=22&&(
                  <span style={{position:'absolute',left:`calc(${pct}% + 8px)`,top:'50%',
                    transform:'translateY(-50%)',fontSize:10,fontWeight:700,
                    color:isHov?'#ccc':'#666',whiteSpace:'nowrap',transition:'color .15s'}}>
                    {fmtR(val)}
                  </span>
                )}
              </div>
              <div style={{fontSize:11,fontWeight:700,
                color:marg>=50?'#22c55e':marg>=35?'#f59e0b':'#C8102E',
                width:44,textAlign:'right',flexShrink:0,fontFamily:'monospace'}}>{fmtM(marg)}</div>
              <div style={{fontSize:10,color:isHov?'#555':'#2a2a2a',
                width:34,textAlign:'right',flexShrink:0,fontFamily:'monospace',transition:'color .15s'}}>{share}%</div>
              <div style={{width:8,height:8,borderRadius:'50%',flexShrink:0,
                background:isSel?corF:'transparent',transition:'background .15s'}}/>
            </div>
          );
        })}
        <div style={{display:'flex',gap:16,marginTop:10,paddingTop:8,borderTop:'1px solid #1a1a1a',fontSize:10,color:'#333'}}>
          <span>📌 Clique = filtrar</span>
          <span>🖱️ Duplo-clique = detalhes</span>
          <span style={{marginLeft:'auto',color:'#3a3a3a'}}>
            <span style={{color:'#22c55e'}}>≥50%</span> · <span style={{color:'#f59e0b'}}>35-50%</span> · <span style={{color:'#C8102E'}}>&lt;35%</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Alertas clicáveis ───────────────────────────────────────
function AlertasCard({ resumo, filialSel, navigate }) {
  const [hov, setHov] = useState(null);
  const items = [
    { label:'✅ Adequado',    key:'adequado',    val:resumo.adequado,    cor:'#22c55e', status:'ADEQUADO' },
    { label:'📉 Baixo',       key:'baixo',       val:resumo.baixo,       cor:'#f97316', status:'BAIXO' },
    { label:'⚠️ Crítico',     key:'criticos',    val:resumo.criticos,    cor:'#C8102E', status:'CRITICO' },
    { label:'📦 Excesso',     key:'excesso',     val:resumo.excesso,     cor:'#f59e0b', status:'EXCESSO' },
    { label:'❌ Sem Estoque', key:'sem_estoque', val:resumo.sem_estoque, cor:'#6b7280', status:'SEM ESTOQUE' },
    { label:'💤 Sem Venda',   key:'sem_venda',   val:resumo.sem_venda,   cor:'#334155', status:'SEM VENDA' },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7, marginTop:4 }}>
      {items.map((a,i) => (
        <div key={a.key}
          onClick={()=>navigate('/produtos',{state:{status:a.status,filial:filialSel!=='Todas'?filialSel:''}})}
          onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}
          style={{
            background: hov===i?`${a.cor}14`:'#111',
            border:`1px solid ${hov===i?a.cor+'44':a.cor+'18'}`,
            borderLeft:`3px solid ${a.cor}`,
            borderRadius:7, padding:'8px 10px', cursor:'pointer',
            transition:'all .15s',
            transform:hov===i?'scale(1.02)':'none',
          }}>
          <div style={{ fontSize:9, color:'#555', marginBottom:3 }}>{a.label}</div>
          <div style={{ fontSize:17, fontWeight:800, color:a.cor, fontFamily:'monospace' }}>{fmt(a.val)}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function Dashboard() {
  const navigate = useNavigate();
  const [lojaModal, setLojaModal] = useState(null);
  const [tab, setTab] = useState('filiais');

  const [filialSel,    setFilialSel]    = useState('Todas');
  const [resumo,       setResumo]       = useState(null);
  const [filiaisLista, setFiliaisLista] = useState([]);
  const [tendencia,    setTendencia]    = useState([]);
  const [gruposF,      setGruposF]      = useState([]);
  const [topItens,     setTopItens]     = useState([]);
  const [loadingF,     setLoadingF]     = useState(true);

  const [resumoMtz,    setResumoMtz]    = useState(null);
  const [tendenciaMtz, setTendenciaMtz] = useState([]);
  const [gruposMtz,    setGruposMtz]    = useState([]);
  const [loadingM,     setLoadingM]     = useState(true);

  // hover estados na tabela de top itens
  const [hovItem, setHovItem] = useState(null);

  const loadFiliais = useCallback(async () => {
    setLoadingF(true);
    try {
      const p = filialSel!=='Todas' ? {filial:filialSel} : {};
      const [r,fl,t,g,top] = await Promise.all([
        api.get('/kpis/filiais-resumo',    {params:p}),
        api.get('/kpis/filiais'),
        api.get('/kpis/tendencia-mensal',  {params:p}),
        api.get('/kpis/grupos-filiais',    {params:{...p,limit:12}}),
        api.get('/kpis/top-itens-filiais', {params:{...p,limit:15}}),
      ]);
      setResumo(r.data);
      setFiliaisLista(fl.data);
      setTendencia(t.data);
      setGruposF(g.data);
      setTopItens(top.data);
    } catch(e){ console.error(e); }
    finally{ setLoadingF(false); }
  },[filialSel]);

  const loadMatriz = useCallback(async () => {
    setLoadingM(true);
    try {
      const [r,t,g] = await Promise.all([
        api.get('/kpis/matriz-resumo'),
        api.get('/kpis/tendencia-matriz'),
        api.get('/kpis/grupos-matriz',{params:{limit:12}}),
      ]);
      setResumoMtz(r.data);
      setTendenciaMtz(t.data);
      setGruposMtz(g.data);
    } catch(e){ console.error(e); }
    finally{ setLoadingM(false); }
  },[]);

  useEffect(()=>{ if(tab==='filiais') loadFiliais(); },[loadFiliais,tab]);
  useEffect(()=>{ if(tab==='matriz')  loadMatriz();  },[loadMatriz,tab]);

  const totalVendas6m = useMemo(()=>filiaisLista.reduce((a,f)=>a+Number(f.vendas_6m||0),0),[filiaisLista]);

  const cobData = resumo ? [
    {name:'ADEQUADO',    value:+resumo.adequado},
    {name:'BAIXO',       value:+resumo.baixo},
    {name:'CRITICO',     value:+resumo.criticos},
    {name:'EXCESSO',     value:+resumo.excesso},
    {name:'SEM ESTOQUE', value:+resumo.sem_estoque},
    {name:'SEM VENDA',   value:+resumo.sem_venda},
  ].filter(d=>d.value>0) : [];

  const cobDataMtz = resumoMtz ? [
    {name:'ADEQUADO',    value:+resumoMtz.adequado},
    {name:'CRITICO',     value:+resumoMtz.criticos},
    {name:'EXCESSO',     value:+resumoMtz.excesso},
    {name:'SEM ESTOQUE', value:+resumoMtz.sem_estoque},
  ].filter(d=>d.value>0) : [];

  const hasData = resumo && Number(resumo.total_itens)>0;

  return (
    <>
      {/* ── Modal loja ─────────────────────────────────────── */}
      {lojaModal&&(
        <div style={{position:'fixed',inset:0,zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={()=>setLojaModal(null)}>
          <div style={{background:'rgba(0,0,0,.72)',position:'absolute',inset:0}}/>
          <div style={{position:'relative',background:'#161616',border:'1px solid #2a2a2a',borderRadius:14,
            padding:'24px 28px',width:540,maxHeight:'82vh',overflowY:'auto',zIndex:1}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <div>
                <div style={{fontFamily:'Bebas Neue',fontSize:28,letterSpacing:2,color:'#f0f0f0'}}>{lojaModal.filial}</div>
                <div style={{fontSize:11,color:'#555'}}>{lojaModal.nome_loja}{lojaModal.cidade?` · ${lojaModal.cidade}/${lojaModal.estado}`:''}</div>
              </div>
              <button onClick={()=>setLojaModal(null)}
                style={{background:'#1f1f1f',border:'1px solid #2a2a2a',borderRadius:8,padding:'6px 12px',color:'#666',cursor:'pointer',fontSize:18}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:14}}>
              {[
                {l:'Vendas 6m',   v:fmtR(lojaModal.vendas_6m),     c:'#22c55e'},
                {l:'Vendas Mês',  v:fmtR(lojaModal.vendas_mes),    c:'#14b8a6'},
                {l:'Estoque',     v:fmtR(lojaModal.valor_estoque),  c:'#f59e0b'},
                {l:'Lucro 6m',    v:fmtR(lojaModal.lucro_6m),       c:'#a855f7'},
                {l:'Margem Real', v:fmtM(lojaModal.margem_real),    c:Number(lojaModal.margem_real)>40?'#22c55e':'#C8102E'},
                {l:'Cobertura',   v:Number(lojaModal.cobertura_media)>0?Number(lojaModal.cobertura_media).toFixed(1)+'m':'—',c:'#888'},
              ].map(k=>(
                <div key={k.l} style={{background:'#111',borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:9,color:'#444',textTransform:'uppercase',letterSpacing:1,marginBottom:3}}>{k.l}</div>
                  <div style={{fontFamily:'monospace',fontSize:16,fontWeight:700,color:k.c}}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:14}}>
              {[{l:'✅ Adequado',v:lojaModal.adequado,c:'#22c55e'},{l:'⚠️ Crítico',v:lojaModal.criticos,c:'#C8102E'},{l:'❌ Sem Est.',v:lojaModal.sem_estoque,c:'#6b7280'},{l:'💤 Sem Venda',v:lojaModal.sem_venda,c:'#334155'}].map(s=>(
                <div key={s.l} style={{flex:1,background:`${s.c}10`,border:`1px solid ${s.c}25`,borderRadius:7,padding:'7px 10px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:s.c,marginBottom:2}}>{s.l}</div>
                  <div style={{fontSize:14,fontWeight:800,color:s.c,fontFamily:'monospace'}}>{fmt(s.v)}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{setFilialSel(lojaModal.filial);setLojaModal(null);}}
                style={{flex:1,background:'rgba(200,16,46,.14)',border:'1px solid rgba(200,16,46,.4)',borderRadius:8,padding:'9px',color:'#C8102E',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                🔍 Filtrar dashboard
              </button>
              <button onClick={()=>{navigate('/produtos',{state:{filial:lojaModal.filial}});setLojaModal(null);}}
                style={{flex:1,background:'rgba(59,130,246,.14)',border:'1px solid rgba(59,130,246,.4)',borderRadius:8,padding:'9px',color:'#3b82f6',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                📦 Ver produtos
              </button>
              <button onClick={()=>{navigate('/grupos',{state:{filial:lojaModal.filial}});setLojaModal(null);}}
                style={{flex:1,background:'rgba(34,197,94,.14)',border:'1px solid rgba(34,197,94,.4)',borderRadius:8,padding:'9px',color:'#22c55e',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                🏷️ Grupos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div style={{display:'flex',gap:0,padding:'0 24px',background:'#111',borderBottom:'1px solid #1a1a1a'}}>
        {[{id:'filiais',label:'🏪 Filiais / Todas as Lojas'},{id:'matriz',label:'🏭 Matriz CD — Estoque Central'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:'transparent',border:'none',borderBottom:`2px solid ${tab===t.id?'#C8102E':'transparent'}`,
              padding:'12px 22px',color:tab===t.id?'#f0f0f0':'#555',fontSize:12,fontWeight:700,
              cursor:'pointer',letterSpacing:.5,transition:'all .18s'}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════ ABA FILIAIS ═══════════════ */}
      {tab==='filiais'&&(
        <div style={{padding:'16px 24px',display:'flex',flexDirection:'column',gap:14}}>

          {/* Seletor de filial */}
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',
            background:'#111',border:'1px solid #1a1a1a',borderRadius:9,padding:'9px 14px'}}>
            <span style={{fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:1,marginRight:2}}>Filtrar por loja:</span>
            {['Todas',...filiaisLista.map(f=>f.filial)].map(cod=>(
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
                ✕ Limpar filtro
              </button>
            )}
          </div>

          {loadingF ? <Loading/> : !hasData ? (
            <div style={{background:'rgba(200,16,46,.05)',border:'1px solid rgba(200,16,46,.18)',borderRadius:12,padding:'40px',textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:12}}>📂</div>
              <div style={{fontFamily:'Bebas Neue',fontSize:22,color:'#f0f0f0',letterSpacing:2,marginBottom:8}}>NENHUM DADO IMPORTADO</div>
              <div style={{fontSize:12,color:'#666'}}>Importe <strong style={{color:'#f39c12'}}>atualizado_sql_todas_as_lojas_csv.csv</strong> em <strong style={{color:'#f39c12'}}>Banco &amp; Planilhas → Lojas / Filiais</strong></div>
            </div>
          ) : (
            <>
              {/* KPIs clicáveis */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:9}}>
                <KPI icon='🏪' label='Lojas'           value={fmt(resumo.total_lojas)}              cor='#3b82f6' prog={100}/>
                <KPI icon='💼' label='Valor Estoque'   value={fmtR(resumo.valor_total_estoque)}     cor='#f59e0b' sub={fmt(resumo.total_pecas,0)+' peças'}
                  onClick={()=>navigate('/produtos',{state:{filial:filialSel!=='Todas'?filialSel:''}})}/>
                <KPI icon='💰' label='Vendas 6 meses'  value={fmtR(resumo.total_vendas_6m)}         cor='#22c55e' sub='Total acumulado'
                  onClick={()=>navigate('/produtos',{state:{filial:filialSel!=='Todas'?filialSel:''}})}/>
                <KPI icon='📅' label='Vendas Mês'      value={fmtR(resumo.total_vendas_mes)}        cor='#14b8a6' sub='Mês mais recente'/>
                <KPI icon='📈' label='Lucro Bruto 6m'  value={fmtR(resumo.total_lucro_6m)}          cor='#a855f7'/>
                <KPI icon='📉' label='Margem Real'     value={fmtM(resumo.margem_real)}             cor='#C8102E' sub='Lucro/Vendas' prog={Math.min(resumo.margem_real/60*100,100)}/>
                <KPI icon='📦' label='Recebido NSD 6m' value={fmtR(resumo.vlr_recebido_nsd)}       cor='#f97316' sub={fmt(resumo.total_recebido_nsd,0)+' peças'}/>
              </div>

              {/* Linha: Tendência + Donut + Alertas */}
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1.1fr',gap:12}}>
                <Card>
                  <CardTitle>
                    Evolução Mensal de Vendas — {filialSel==='Todas'?'Todas as Lojas':filialSel}
                    <span style={{fontSize:9,color:'#444',fontWeight:400,marginLeft:8}}>passe o mouse nos pontos</span>
                  </CardTitle>
                  <LineChart data={tendencia} valueKey='vendas' labelKey='mes' cor='#C8102E' height={130}/>
                </Card>
                <Card>
                  <CardTitle>Cobertura de Estoque <span style={{fontSize:9,color:'#444',fontWeight:400}}>hover = detalhe</span></CardTitle>
                  <Donut data={cobData} colors={cobData.map(d=>CORES_STATUS[d.name]||'#555')} center={fmt(resumo.total_itens)} sub="itens" size={140}/>
                </Card>
                <Card>
                  <CardTitle>Alertas <span style={{fontSize:9,color:'#444',fontWeight:400}}>clique = filtrar produtos</span></CardTitle>
                  <AlertasCard resumo={resumo} filialSel={filialSel} navigate={navigate}/>
                </Card>
              </div>

              {/* Performance por Loja */}
              <PerformanceLojas
                filiaisLista={filiaisLista}
                filialSel={filialSel}
                setFilialSel={setFilialSel}
                setLojaModal={setLojaModal}
                totalVendas6m={totalVendas6m}
              />

              {/* Grupos + tabela */}
              <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:12}}>
                <Card>
                  <CardTitle>
                    Top Grupos — {filialSel==='Todas'?'Todas as Lojas':filialSel}
                    <span style={{fontSize:9,color:'#444',fontWeight:400,marginLeft:8}}>clique = ver produtos do grupo</span>
                  </CardTitle>
                  <BarChart
                    data={gruposF}
                    valueKey='vlr_vendido_6m'
                    labelKey='grupo'
                    maxItems={10}
                    colorFn={(_,i)=>['#C8102E','#b00026','#e63950','#f97316','#f59e0b','#22c55e','#14b8a6','#3b82f6','#a855f7','#6b7280'][i]}
                    onClickItem={d=>navigate('/produtos',{state:{grupo:d.grupo,filial:filialSel!=='Todas'?filialSel:''}})}
                  />
                </Card>
                <Card>
                  <CardTitle>Grupos — Margem e Lucro</CardTitle>
                  <div style={{overflowX:'auto',marginTop:6}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                      <thead><tr>
                        {['Grupo','Itens','Vendas 6m','Lucro','Margem'].map(h=>(
                          <th key={h} style={{textAlign:'left',fontSize:9,textTransform:'uppercase',letterSpacing:.8,
                            color:'#555',padding:'5px 8px',borderBottom:'1px solid #1a1a1a'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {gruposF.slice(0,10).map((g,i)=>(
                          <tr key={i}
                            style={{borderBottom:'1px solid #111',cursor:'pointer',transition:'background .1s'}}
                            onClick={()=>navigate('/produtos',{state:{grupo:g.grupo,filial:filialSel!=='Todas'?filialSel:''}})}
                            onMouseEnter={e=>e.currentTarget.style.background='rgba(200,16,46,.05)'}
                            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <td style={{padding:'6px 8px',fontWeight:700,color:'#ddd'}}>{g.grupo}</td>
                            <td style={{padding:'6px 8px',color:'#555',fontFamily:'monospace'}}>{fmt(g.total_itens)}</td>
                            <td style={{padding:'6px 8px',fontFamily:'monospace'}}>{fmtR(g.vlr_vendido_6m)}</td>
                            <td style={{padding:'6px 8px',fontFamily:'monospace',color:'#14b8a6'}}>{fmtR(g.lucro_6m)}</td>
                            <td style={{padding:'6px 8px',fontWeight:700,color:Number(g.margem_pct)>=50?'#22c55e':Number(g.margem_pct)>=30?'#f59e0b':'#C8102E'}}>{fmtM(g.margem_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Top itens */}
              <Card>
                <CardTitle right={
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:10,color:'#444'}}>Top 15 · {filialSel==='Todas'?'Todas as Lojas':filialSel}</span>
                    <button onClick={()=>navigate('/produtos',{state:{filial:filialSel!=='Todas'?filialSel:''}})}
                      style={{background:'rgba(200,16,46,.1)',border:'1px solid rgba(200,16,46,.3)',
                        borderRadius:5,padding:'3px 9px',color:'#C8102E',fontSize:10,fontWeight:700,cursor:'pointer'}}>
                      Ver todos →
                    </button>
                  </div>
                }>
                  Produtos Mais Vendidos
                </CardTitle>
                <div style={{overflowX:'auto',marginTop:4}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                    <thead><tr>
                      {['Filial','Referência','Descrição','Grupo','Estoque (un)','Vds 6m (un)','Vds Mês (un)','Margem','Status'].map(h=>(
                        <th key={h} style={{background:'#1a1a1a',textAlign:'left',fontSize:9,textTransform:'uppercase',
                          letterSpacing:.8,color:'#555',padding:'8px 10px',borderBottom:'1px solid #222',fontWeight:500,whiteSpace:'nowrap'}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {topItens.map((r,i)=>(
                        <tr key={i}
                          style={{borderBottom:'1px solid #171717',cursor:'pointer',
                            background:hovItem===i?'rgba(200,16,46,.05)':'transparent',transition:'background .08s'}}
                          onClick={()=>navigate('/produtos',{state:{filial:r.filial,grupo:r.grupo}})}
                          onMouseEnter={()=>setHovItem(i)}
                          onMouseLeave={()=>setHovItem(null)}>
                          <td style={{padding:'7px 10px',color:'#f59e0b',fontWeight:700}}>{r.filial}</td>
                          <td style={{padding:'7px 10px',fontFamily:'monospace',fontSize:10,color:'#555'}}>{r.referencia}</td>
                          <td style={{padding:'7px 10px',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#ddd'}} title={r.descricao}>{r.descricao}</td>
                          <td style={{padding:'7px 10px',fontWeight:700,color:'#aaa'}}>{r.grupo}</td>
                          <td style={{padding:'7px 10px',color:'#60a5fa',fontFamily:'monospace',textAlign:'right'}}>{Number(r.saldo_estoque_filial)>0?fmt(r.saldo_estoque_filial)+' un':'—'}</td>
                          <td style={{padding:'7px 10px',fontFamily:'monospace',fontWeight:700,textAlign:'right',color:'#22c55e'}}>{Number(r.qtd_vendida_filial_6m||0)>0?fmt(r.qtd_vendida_filial_6m)+' un':fmtR(r.vlr_vendido_filial_6m)}</td>
                          <td style={{padding:'7px 10px',fontFamily:'monospace',color:'#aaa',textAlign:'right'}}>{Number(r.qtd_vendida_filial_mes||0)>0?fmt(r.qtd_vendida_filial_mes)+' un':fmtR(r.vlr_vendido_filial_mes)}</td>
                          <td style={{padding:'7px 10px',fontWeight:700,textAlign:'right',color:Number(r.margem_pct_filial)>=50?'#22c55e':Number(r.margem_pct_filial)>=30?'#f59e0b':'#C8102E'}}>{fmtM(r.margem_pct_filial)}</td>
                          <td style={{padding:'7px 10px'}}><StatusBadge status={r.status_cobertura_filial}/></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ═══════════════ ABA MATRIZ ═══════════════ */}
      {tab==='matriz'&&(
        <div style={{padding:'16px 24px',display:'flex',flexDirection:'column',gap:14}}>
          {loadingM?<Loading/>:!resumoMtz||Number(resumoMtz.total_itens)===0?(
            <div style={{background:'rgba(200,16,46,.05)',border:'1px solid rgba(200,16,46,.18)',borderRadius:12,padding:'40px',textAlign:'center'}}>
              <div style={{fontSize:32,marginBottom:12}}>📂</div>
              <div style={{fontFamily:'Bebas Neue',fontSize:22,color:'#f0f0f0',letterSpacing:2,marginBottom:8}}>NENHUM DADO IMPORTADO</div>
              <div style={{fontSize:12,color:'#666'}}>Importe <strong style={{color:'#f39c12'}}>nsd_sql_compra_final.xlsx</strong> em <strong style={{color:'#f39c12'}}>Banco &amp; Planilhas → Planilhas</strong></div>
            </div>
          ):(
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:9}}>
                <KPI icon='📦' label='Itens CD'            value={fmt(resumoMtz.total_itens)}          cor='#3b82f6' sub={fmt(resumoMtz.total_pecas,0)+' peças'}/>
                <KPI icon='💼' label='Valor Estoque CD'    value={fmtR(resumoMtz.valor_estoque)}       cor='#f59e0b'/>
                <KPI icon='🚚' label='Saídas CD 6m'        value={fmtR(resumoMtz.saidas_6m)}           cor='#22c55e' sub='Transf. + Diretas'/>
                <KPI icon='🛒' label='Comprado 6m'         value={fmtR(resumoMtz.comprado_6m)}         cor='#a855f7'/>
                <KPI icon='📈' label='Lucro Bruto 6m'      value={fmtR(resumoMtz.lucro_6m)}            cor='#14b8a6'/>
                <KPI icon='📉' label='Margem CD'           value={fmtM(resumoMtz.margem_pct)}          cor='#C8102E' prog={Math.min(resumoMtz.margem_pct/20*100,100)}/>
                <KPI icon='📅' label='Dias s/ Compra'      value={fmt(resumoMtz.media_dias_sem_compra)} cor='#f97316'/>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1.1fr',gap:12}}>
                <Card>
                  <CardTitle>Evolução de Saídas — CD Matriz <span style={{fontSize:9,color:'#444',fontWeight:400}}>hover nos pontos</span></CardTitle>
                  <LineChart data={tendenciaMtz} valueKey='vendas' labelKey='mes' cor='#3b82f6' height={130}/>
                </Card>
                <Card>
                  <CardTitle>Cobertura — CD <span style={{fontSize:9,color:'#444',fontWeight:400}}>hover = detalhe</span></CardTitle>
                  <Donut data={cobDataMtz} colors={cobDataMtz.map(d=>CORES_STATUS[d.name]||'#555')} center={fmt(resumoMtz.total_itens)} sub="itens" size={140}/>
                </Card>
                <Card>
                  <CardTitle>Alertas — CD Matriz</CardTitle>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:4}}>
                    {[
                      {label:'✅ Adequado',    val:resumoMtz.adequado,    cor:'#22c55e'},
                      {label:'⚠️ Crítico',     val:resumoMtz.criticos,    cor:'#C8102E'},
                      {label:'📦 Excesso',     val:resumoMtz.excesso,     cor:'#f59e0b'},
                      {label:'❌ Sem Estoque', val:resumoMtz.sem_estoque, cor:'#6b7280'},
                    ].map(a=>(
                      <div key={a.label} style={{background:'#111',border:`1px solid ${a.cor}18`,borderLeft:`3px solid ${a.cor}`,borderRadius:7,padding:'8px 10px'}}>
                        <div style={{fontSize:9,color:'#555',marginBottom:3}}>{a.label}</div>
                        <div style={{fontSize:16,fontWeight:800,color:a.cor,fontFamily:'monospace'}}>{fmt(a.val)}</div>
                      </div>
                    ))}
                    <div style={{gridColumn:'span 2',background:'#111',border:'1px solid #334155',borderLeft:'3px solid #334155',borderRadius:7,padding:'8px 10px'}}>
                      <div style={{fontSize:9,color:'#555',marginBottom:3}}>🚫 Sem Compra 6m</div>
                      <div style={{fontSize:16,fontWeight:800,color:'#334155',fontFamily:'monospace'}}>{fmt(resumoMtz.sem_compra)}</div>
                    </div>
                  </div>
                </Card>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:12}}>
                <Card>
                  <CardTitle>Top Grupos — Saídas 6m · CD Matriz</CardTitle>
                  <BarChart data={gruposMtz} valueKey='saidas_6m' labelKey='grupo' maxItems={10}
                    colorFn={(_,i)=>['#3b82f6','#60a5fa','#2563eb','#1d4ed8','#1e40af','#1e3a8a','#172554','#0c1a3a','#06102a','#020918'][i]}/>
                </Card>
                <Card>
                  <CardTitle>Grupos — Margem CD</CardTitle>
                  <div style={{overflowX:'auto',marginTop:6}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                      <thead><tr>
                        {['Grupo','Itens','Saídas 6m','Lucro','Margem'].map(h=>(
                          <th key={h} style={{textAlign:'left',fontSize:9,textTransform:'uppercase',letterSpacing:.8,color:'#555',padding:'5px 8px',borderBottom:'1px solid #1a1a1a'}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {gruposMtz.slice(0,10).map((g,i)=>(
                          <tr key={i} style={{borderBottom:'1px solid #111'}}>
                            <td style={{padding:'6px 8px',fontWeight:700,color:'#ddd'}}>{g.grupo}</td>
                            <td style={{padding:'6px 8px',color:'#555',fontFamily:'monospace'}}>{fmt(g.total_itens)}</td>
                            <td style={{padding:'6px 8px',fontFamily:'monospace'}}>{fmtR(g.saidas_6m)}</td>
                            <td style={{padding:'6px 8px',fontFamily:'monospace',color:'#14b8a6'}}>{fmtR(g.lucro_6m)}</td>
                            <td style={{padding:'6px 8px',fontWeight:700,color:Number(g.margem_pct)>10?'#22c55e':Number(g.margem_pct)>5?'#f59e0b':'#C8102E'}}>{fmtM(g.margem_pct)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
