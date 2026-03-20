// src/pages/MapaLojas.jsx — Mapa das Filiais com filtro por loja
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { Card, CardTitle, Loading } from '../components/UI';

// ─── CSS Leaflet dark ─────────────────────────────────────────────────────────
const LEAFLET_CSS = `
  .leaflet-container { background:#111 !important; font-family:'DM Sans',sans-serif !important; }
  .leaflet-tile { background:#111; }
  .leaflet-tile-loaded { background:transparent; }
  .leaflet-control-zoom { border:1px solid #2a2a2a !important; box-shadow:none !important; }
  .leaflet-control-zoom a { background:#161616 !important; color:#f0f0f0 !important; border-color:#2a2a2a !important; width:30px !important; height:30px !important; line-height:30px !important; font-size:16px !important; }
  .leaflet-control-zoom a:hover { background:#C8102E !important; color:#fff !important; }
  .leaflet-popup-content-wrapper { background:#1a1a1a !important; border:1px solid #2a2a2a !important; border-radius:12px !important; color:#f0f0f0 !important; box-shadow:0 8px 40px rgba(0,0,0,.8) !important; min-width:220px; }
  .leaflet-popup-tip { background:#1a1a1a !important; }
  .leaflet-popup-close-button { color:#555 !important; font-size:16px !important; top:8px !important; right:8px !important; }
  .leaflet-control-attribution { background:rgba(13,13,13,.8) !important; color:#333 !important; font-size:9px !important; }
  .leaflet-control-attribution a { color:#555 !important; }
`;

// ─── Coordenadas reais das 18 filiais ─────────────────────────────────────────
const FILIAIS_GEO = {
  PRZ: { lat: -5.9225,  lng: -35.2616, nome: 'Parnamirim (Matriz)',       cidade: 'Parnamirim',        uf: 'RN' },
  NAB: { lat: -5.7945,  lng: -35.2110, nome: 'Natal Boa Viagem',          cidade: 'Natal',             uf: 'RN' },
  SCR: { lat: -6.2252,  lng: -35.8020, nome: 'Santa Cruz',                cidade: 'Santa Cruz',        uf: 'RN' },
  PET: { lat: -9.3891,  lng: -40.5030, nome: 'Petrolina',                 cidade: 'Petrolina',         uf: 'PE' },
  AJU: { lat: -10.9472, lng: -37.0731, nome: 'Aracaju',                   cidade: 'Aracaju',           uf: 'SE' },
  SAL: { lat: -12.9714, lng: -38.5014, nome: 'Salvador',                  cidade: 'Salvador',          uf: 'BA' },
  FEI: { lat: -12.2664, lng: -38.9663, nome: 'Feira de Santana',          cidade: 'Feira de Santana',  uf: 'BA' },
  CGR: { lat: -20.4697, lng: -54.6201, nome: 'Campo Grande',              cidade: 'Campo Grande',      uf: 'MS' },
  CRU: { lat: -12.6593, lng: -39.1058, nome: 'Cruz das Almas',            cidade: 'Cruz das Almas',    uf: 'BA' },
  ARP: { lat: -7.5527,  lng: -40.4983, nome: 'Araripina',                 cidade: 'Araripina',         uf: 'PE' },
  IPS: { lat: -8.3997,  lng: -35.0617, nome: 'Ipojuca',                   cidade: 'Ipojuca',           uf: 'PE' },
  MCO: { lat: -5.1879,  lng: -37.3441, nome: 'Mossoró Centro',            cidade: 'Mossoró',           uf: 'RN' },
  PAR: { lat: -2.9056,  lng: -41.7760, nome: 'Parnaíba',                  cidade: 'Parnaíba',          uf: 'PI' },
  FZA: { lat: -3.7172,  lng: -38.5434, nome: 'Fortaleza',                 cidade: 'Fortaleza',         uf: 'CE' },
  SJP: { lat: -8.3565,  lng: -42.2500, nome: 'São João do Piauí',         cidade: 'São João do Piauí', uf: 'PI' },
  SMP: { lat: -7.6000,  lng: -40.8333, nome: 'Simões',                    cidade: 'Simões',            uf: 'PI' },
  VMA: { lat: -13.3700, lng: -39.0738, nome: 'Valença',                   cidade: 'Valença',           uf: 'BA' },
  '0NN':{ lat: -8.0539, lng: -34.9293, nome: 'Loja Nova (0NN)',           cidade: 'Recife',            uf: 'PE' },
};

const PALETTE = ['#C8102E','#3b82f6','#22c55e','#f59e0b','#a855f7','#14b8a6','#f97316','#e63950',
                 '#60a5fa','#34d399','#fbbf24','#c084fc','#2dd4bf','#fb923c','#818cf8','#4ade80','#facc15','#f472b6'];

const fmt  = (n, d=0) => n==null||isNaN(n)?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtR = (n) => n==null||isNaN(n)?'—':'R$ '+fmt(n,0);
const fmtM = (n) => n==null||isNaN(n)?'—':fmt(n,1)+'%';

// ─── Fix ícones Leaflet no Vite ───────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeIcon(cor, isSelected, isMatriz) {
  const size  = isSelected ? 44 : 34;
  const emoji = isMatriz ? '🏭' : '🏪';
  const borda = isSelected ? '3px solid #fff' : '2px solid rgba(255,255,255,.5)';
  const glow  = isSelected ? `0 0 0 8px ${cor}44,0 0 24px ${cor}88,0 4px 16px rgba(0,0,0,.8)` : `0 0 0 4px ${cor}33,0 3px 10px rgba(0,0,0,.6)`;
  const html  = `<div style="width:${size}px;height:${size}px;background:${cor};border:${borda};border-radius:50%;
    display:flex;align-items:center;justify-content:center;font-size:${isSelected?18:14}px;
    box-shadow:${glow};cursor:pointer;transition:all .2s;">${emoji}</div>`;
  return L.divIcon({ className:'', html, iconSize:[size,size], iconAnchor:[size/2,size/2], popupAnchor:[0,-size/2-6] });
}

function FlyTo({ filial }) {
  const map = useMap();
  useEffect(() => {
    if (!filial) return;
    const geo = FILIAIS_GEO[filial];
    if (geo) map.flyTo([geo.lat, geo.lng], 12, { duration: 1.0 });
  }, [filial]);
  return null;
}

function FitAll({ lojas }) {
  const map = useMap();
  useEffect(() => {
    if (!lojas.length) return;
    const bounds = L.latLngBounds(lojas.map(l => [FILIAIS_GEO[l.filial]?.lat, FILIAIS_GEO[l.filial]?.lng]).filter(c => c[0]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding:[40,40] });
  }, []);
  return null;
}

// ─── Mapa principal ───────────────────────────────────────────────────────────
function LojasMapa({ lojas, selected, onSelect, filialFiltro }) {
  const center = [-8.5, -38.5];

  const visiveis = filialFiltro ? lojas.filter(l => l.filial === filialFiltro) : lojas;

  return (
    <div style={{ height:'520px', width:'100%', position:'relative', borderRadius:'10px', overflow:'hidden' }}>
      <style>{LEAFLET_CSS}</style>
      <MapContainer center={center} zoom={5} style={{ height:'100%', width:'100%' }} scrollWheelZoom zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {filialFiltro
          ? <FlyTo filial={filialFiltro} />
          : <FitAll lojas={visiveis} />
        }

        {visiveis.map((loja, i) => {
          const geo  = FILIAIS_GEO[loja.filial];
          if (!geo) return null;
          const cor  = PALETTE[i % PALETTE.length];
          const isSel = selected?.filial === loja.filial;
          const isMatriz = loja.filial === 'PRZ';

          return (
            <Marker
              key={loja.filial}
              position={[geo.lat, geo.lng]}
              icon={makeIcon(cor, isSel, isMatriz)}
              eventHandlers={{ click: () => onSelect(loja) }}
            >
              {isSel && <Circle center={[geo.lat, geo.lng]} radius={8000} pathOptions={{ color:cor, fillColor:cor, fillOpacity:0.06, weight:1.5, dashArray:'6 4' }} />}
              <Popup minWidth={220}>
                <div style={{ fontFamily:'DM Sans,sans-serif', padding:'4px 0' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:cor, flexShrink:0 }} />
                    <div>
                      <div style={{ fontWeight:800, fontSize:'13px', color:'#f0f0f0', letterSpacing:.5 }}>{loja.filial}</div>
                      <div style={{ fontSize:'10px', color:'#666' }}>{geo.nome} — {geo.cidade}/{geo.uf}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'10px' }}>
                    {[
                      { l:'Estoque',   v: fmtR(loja.valor_estoque) },
                      { l:'Vendas 6m', v: fmtR(loja.vendas_6m)    },
                      { l:'Lucro 6m',  v: fmtR(loja.lucro_6m)     },
                      { l:'Margem',    v: fmtM(loja.margem_media)  },
                    ].map(m => (
                      <div key={m.l} style={{ background:'#111', borderRadius:'6px', padding:'5px 8px' }}>
                        <div style={{ fontSize:'9px', color:'#555', textTransform:'uppercase', letterSpacing:1 }}>{m.l}</div>
                        <div style={{ fontSize:'11px', fontWeight:700, color:'#ddd', fontFamily:'monospace' }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                    {[
                      { label:'✅ OK',     val: loja.adequado,    color:'#22c55e' },
                      { label:'⚠️ Crít',   val: loja.criticos,    color:'#C8102E' },
                      { label:'❌ S/Est',  val: loja.sem_estoque, color:'#6b7280' },
                    ].map(s => (
                      <span key={s.label} style={{ fontSize:'10px', color:s.color, background:`${s.color}18`, border:`1px solid ${s.color}33`, borderRadius:'4px', padding:'2px 7px' }}>
                        {s.label} {fmt(s.val)}
                      </span>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Badge de contagem sobreposto */}
      <div style={{ position:'absolute', top:12, left:12, zIndex:1000, background:'rgba(13,13,13,.92)', backdropFilter:'blur(8px)', border:'1px solid #2a2a2a', borderRadius:'10px', padding:'8px 14px', color:'#f0f0f0', fontSize:'11px', pointerEvents:'none' }}>
        🏪 <strong style={{ color:'#C8102E' }}>{visiveis.length}</strong> {visiveis.length===1?'loja':'lojas'} exibidas
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function MapaLojas() {
  const navigate = useNavigate();
  const [lojas,       setLojas]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [filialFiltro,setFilialFiltro]= useState('');   // '' = todas
  const [busca,       setBusca]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/kpis/filiais');
      // Enriquece com geo
      const com_geo = data.filter(l => FILIAIS_GEO[l.filial]);
      setLojas(com_geo);
      if (com_geo.length) setSelected(com_geo[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lojas filtradas para lista lateral
  const listaFiltrada = useMemo(() => {
    let lista = lojas;
    if (filialFiltro)  lista = lista.filter(l => l.filial === filialFiltro);
    if (busca.trim())  lista = lista.filter(l =>
      (l.filial + l.nome_loja + (FILIAIS_GEO[l.filial]?.cidade||'')).toLowerCase().includes(busca.toLowerCase())
    );
    return lista;
  }, [lojas, filialFiltro, busca]);

  // Totais do filtro atual
  const totais = useMemo(() => ({
    valor:  listaFiltrada.reduce((a,l)=>a+Number(l.valor_estoque||0),0),
    vendas: listaFiltrada.reduce((a,l)=>a+Number(l.vendas_6m||0),0),
    lucro:  listaFiltrada.reduce((a,l)=>a+Number(l.lucro_6m||0),0),
    itens:  listaFiltrada.reduce((a,l)=>a+Number(l.total_itens||0),0),
  }), [listaFiltrada]);

  function selecionarLoja(loja) {
    setSelected(loja);
    setFilialFiltro(loja.filial);
  }

  function limparFiltro() {
    setFilialFiltro('');
    setBusca('');
    setSelected(lojas[0] || null);
  }

  if (loading) return <div style={{ padding:40 }}><Loading /></div>;

  return (
    <div style={{ padding:'18px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* ── Cabeçalho + Filtros ─────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'Bebas Neue', fontSize:28, letterSpacing:2, color:'#f0f0f0', margin:0 }}>
            MAPA DAS LOJAS
          </h1>
          <div style={{ fontSize:11, color:'#555', marginTop:2 }}>
            {lojas.length} filiais com dados · clique num marcador ou loja para focar
          </div>
        </div>

        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          {/* Busca texto */}
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="🔍 Buscar loja ou cidade..."
            style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:8, padding:'8px 14px', color:'#f0f0f0', fontSize:12, width:220 }}
          />

          {/* Dropdown filtro de loja */}
          <select
            value={filialFiltro}
            onChange={e => {
              const cod = e.target.value;
              setFilialFiltro(cod);
              if (cod) {
                const loja = lojas.find(l => l.filial === cod);
                if (loja) setSelected(loja);
              }
            }}
            style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:8, padding:'8px 14px', color: filialFiltro?'#f0f0f0':'#666', fontSize:12, minWidth:200 }}
          >
            <option value="">📍 Todas as lojas</option>
            {lojas.map(l => (
              <option key={l.filial} value={l.filial}>
                {l.filial} — {l.nome_loja || FILIAIS_GEO[l.filial]?.nome}
              </option>
            ))}
          </select>

          {/* Botão limpar */}
          {(filialFiltro || busca) && (
            <button onClick={limparFiltro}
              style={{ background:'rgba(200,16,46,.15)', border:'1px solid rgba(200,16,46,.4)', borderRadius:8, padding:'8px 14px', color:'#C8102E', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              ✕ Limpar filtro
            </button>
          )}

          <button onClick={load}
            style={{ background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:8, padding:'8px 14px', color:'#888', fontSize:12, cursor:'pointer' }}>
            🔄 Atualizar
          </button>
        </div>
      </div>

      {/* ── KPIs do filtro atual ─────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {[
          { icon:'🏪', label: filialFiltro?'Loja selecionada':'Lojas exibidas', value: filialFiltro?'1 loja':listaFiltrada.length+' lojas' },
          { icon:'📦', label:'Itens em estoque', value: fmt(totais.itens) },
          { icon:'💼', label:'Valor estoque',    value: 'R$'+fmt(totais.valor/1e6,1)+'M' },
          { icon:'💰', label:'Vendas 6m',        value: 'R$'+fmt(totais.vendas/1e6,1)+'M' },
        ].map(k => (
          <div key={k.label} style={{ background:'#161616', border:'1px solid #1e1e1e', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:1.2, marginBottom:4 }}>{k.icon} {k.label}</div>
            <div style={{ fontSize:20, fontWeight:800, color:'#f0f0f0', fontFamily:'monospace' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Layout: Mapa + Painel lateral ───────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:14 }}>

        {/* Mapa */}
        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px 10px' }}>
            <CardTitle>
              {filialFiltro
                ? `${filialFiltro} — ${FILIAIS_GEO[filialFiltro]?.nome}`
                : 'Todas as Lojas — Nordeste & Brasil'
              }
            </CardTitle>
          </div>
          {listaFiltrada.length > 0
            ? <LojasMapa lojas={listaFiltrada} selected={selected} onSelect={selecionarLoja} filialFiltro={filialFiltro} />
            : <div style={{ height:520, display:'flex', alignItems:'center', justifyContent:'center', color:'#555', fontSize:13 }}>
                Nenhuma loja com dados para exibir. Importe o CSV em <strong style={{color:'#f39c12',marginLeft:4}}>Dados → Lojas</strong>.
              </div>
          }
        </Card>

        {/* Painel lateral */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Detalhes da loja selecionada */}
          {selected && (
            <Card>
              <CardTitle>Detalhes da Loja</CardTitle>
              <div style={{ marginTop:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'#C8102E', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                    {selected.filial === 'PRZ' ? '🏭' : '🏪'}
                  </div>
                  <div>
                    <div style={{ fontWeight:800, fontSize:16, color:'#fff', letterSpacing:1 }}>{selected.filial}</div>
                    <div style={{ fontSize:11, color:'#555' }}>{selected.nome_loja || FILIAIS_GEO[selected.filial]?.nome}</div>
                    <div style={{ fontSize:10, color:'#444' }}>{FILIAIS_GEO[selected.filial]?.cidade} / {FILIAIS_GEO[selected.filial]?.uf}</div>
                  </div>
                </div>
                {[
                  { label:'Itens em estoque', value: fmt(selected.total_itens)        },
                  { label:'Valor em estoque', value: fmtR(selected.valor_estoque)     },
                  { label:'Vendas 6 meses',   value: fmtR(selected.vendas_6m)         },
                  { label:'Vendas mês atual', value: fmtR(selected.vendas_mes)        },
                  { label:'Lucro bruto 6m',   value: fmtR(selected.lucro_6m)          },
                  { label:'Margem média',     value: fmtM(selected.margem_media)      },
                  { label:'Cobertura média',  value: fmt(selected.cobertura_media,1)+' meses' },
                ].map(d => (
                  <div key={d.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #1a1a1a' }}>
                    <span style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:.8 }}>{d.label}</span>
                    <strong style={{ fontSize:12, fontFamily:'monospace', color:'#ddd' }}>{d.value}</strong>
                  </div>
                ))}
                <div style={{ marginTop:10, display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[
                    { label:'✅ Adequado',   val: selected.adequado,    color:'#22c55e' },
                    { label:'⚠️ Crítico',    val: selected.criticos,    color:'#C8102E' },
                    { label:'❌ Sem Est.',   val: selected.sem_estoque, color:'#6b7280' },
                    { label:'📦 Excesso',    val: selected.excesso,     color:'#f59e0b' },
                  ].map(s => (
                    <div key={s.label} style={{ fontSize:10, color:s.color, background:`${s.color}14`, border:`1px solid ${s.color}30`, borderRadius:5, padding:'3px 8px', flexGrow:1, textAlign:'center' }}>
                      {s.label}<br/><strong style={{ fontSize:12 }}>{fmt(s.val)}</strong>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setFilialFiltro(f => f === selected.filial ? '' : selected.filial); }}
                  style={{ marginTop:12, width:'100%', background: filialFiltro===selected.filial?'rgba(200,16,46,.18)':'#1f1f1f', border:`1px solid ${filialFiltro===selected.filial?'rgba(200,16,46,.5)':'#2a2a2a'}`, borderRadius:8, padding:'9px', color: filialFiltro===selected.filial?'#C8102E':'#888', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  {filialFiltro === selected.filial ? '🗺️ Ver todas as lojas' : '🔍 Isolar esta loja'}
                </button>
                <button
                  onClick={() => navigate('/produtos', { state: { filial: selected.filial } })}
                  style={{ marginTop:6, width:'100%', background:'rgba(59,130,246,.12)', border:'1px solid rgba(59,130,246,.35)', borderRadius:8, padding:'9px', color:'#3b82f6', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  📦 Ver produtos desta loja
                </button>
              </div>
            </Card>
          )}

          {/* Lista de lojas */}
          <Card>
            <CardTitle>
              {filialFiltro ? 'Loja Selecionada' : `Todas as Lojas (${listaFiltrada.length})`}
            </CardTitle>
            <div style={{ maxHeight:300, overflowY:'auto', marginTop:10 }}>
              {listaFiltrada.map((l, i) => {
                const cor  = PALETTE[lojas.indexOf(l) % PALETTE.length];
                const isSel = selected?.filial === l.filial;
                return (
                  <div key={l.filial}
                    onClick={() => selecionarLoja(l)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:8, cursor:'pointer', marginBottom:4,
                      background: isSel?`${cor}14`:'transparent', border:`1px solid ${isSel?`${cor}44`:'transparent'}`,
                      transition:'all .15s' }}>
                    <div style={{ width:9, height:9, borderRadius:'50%', background:cor, flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span style={{ fontWeight:700, fontSize:12, color:'#ddd' }}>{l.filial}</span>
                        <span style={{ fontSize:10, color:'#555' }}>{FILIAIS_GEO[l.filial]?.uf}</span>
                      </div>
                      <div style={{ fontSize:10, color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {FILIAIS_GEO[l.filial]?.cidade}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#aaa', fontFamily:'monospace' }}>
                        {l.vendas_6m>0?'R$'+fmt(l.vendas_6m/1e3,0)+'K':'—'}
                      </div>
                      <div style={{ fontSize:9, color: Number(l.margem_media)>20?'#22c55e':Number(l.margem_media)>10?'#f59e0b':'#555' }}>
                        {fmtM(l.margem_media)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
