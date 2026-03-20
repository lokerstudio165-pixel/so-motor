// src/pages/Frota.jsx
// Requer: npm install leaflet react-leaflet

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { Card, CardTitle, KpiCard, Loading } from '../components/UI';

// ─── CSS do Leaflet injetado diretamente — garante funcionamento no Vite ───────
const LEAFLET_CSS = `
  .leaflet-container { background: #1a1a1a !important; font-family: 'DM Sans', sans-serif !important; }
  .leaflet-tile-pane { -webkit-filter: none; filter: none; }
  .leaflet-tile { background: #1a1a1a; }
  .leaflet-tile-loaded { background: transparent; }
  .leaflet-control-zoom { border: 1px solid #2a2a2a !important; box-shadow: none !important; }
  .leaflet-control-zoom a { background: #161616 !important; color: #f0f0f0 !important; border-color: #2a2a2a !important; width: 30px !important; height: 30px !important; line-height: 30px !important; font-size: 16px !important; }
  .leaflet-control-zoom a:hover { background: #C8102E !important; color: #fff !important; }
  .leaflet-popup-content-wrapper { background: #1a1a1a !important; border: 1px solid #2a2a2a !important; border-radius: 10px !important; color: #f0f0f0 !important; box-shadow: 0 8px 32px rgba(0,0,0,.7) !important; }
  .leaflet-popup-tip { background: #1a1a1a !important; }
  .leaflet-popup-close-button { color: #666 !important; font-size: 16px !important; }
  .leaflet-control-attribution { background: rgba(13,13,13,.8) !important; color: #444 !important; font-size: 9px !important; }
  .leaflet-control-attribution a { color: #666 !important; }
`;

// ─── Fix ícones Leaflet no Vite ────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const fmt  = (n, d = 0) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtR = (n) => 'R$ ' + fmt(n, 2);

const STATUS_STYLE = {
  'Online':  { bg: 'rgba(34,197,94,.15)',  color: '#22c55e', hex: '#22c55e' },
  'Em rota': { bg: 'rgba(59,130,246,.15)', color: '#60a5fa', hex: '#3b82f6' },
  'Alerta':  { bg: 'rgba(245,158,11,.15)', color: '#f59e0b', hex: '#f59e0b' },
};

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || { bg: '#222', color: '#aaa' };
  return (
    <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function makeIcon(status, isSelected) {
  const s    = STATUS_STYLE[status] || { hex: '#C8102E' };
  const size = isSelected ? 42 : 34;
  const emoji = status === 'Alerta' ? '⚠️' : status === 'Em rota' ? '🚚' : '📍';
  const html = `<div style="width:${size}px;height:${size}px;background:${s.hex};border:${isSelected?'3px':'2.5px'} solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${isSelected?18:15}px;box-shadow:0 0 0 ${isSelected?8:5}px ${s.hex}55,0 0 20px ${s.hex}88,0 4px 14px rgba(0,0,0,.7);cursor:pointer;">${emoji}</div>`;
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -size/2-4] });
}

function FlyToSelected({ vehicle }) {
  const map = useMap();
  useEffect(() => {
    if (vehicle?.latitude && vehicle?.longitude) {
      map.flyTo([Number(vehicle.latitude), Number(vehicle.longitude)], 13, { duration: 1.2 });
    }
  }, [vehicle]);
  return null;
}

// ─── Abre Google Maps Street View na localização do veículo ───────────────────
function openStreetView(lat, lng) {
  window.open(`https://www.google.com/maps?q=${lat},${lng}&layer=c&cbll=${lat},${lng}`, '_blank');
}

// ─── Abre rota no Google Maps ─────────────────────────────────────────────────
function openGoogleMaps(lat, lng, label) {
  window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}(${encodeURIComponent(label)})`, '_blank');
}

function FleetMap({ vehicles, selected, onSelect }) {
  const center = useMemo(() => {
    if (!vehicles.length) return [-8.0476, -34.8770];
    const lats = vehicles.map(v => Number(v.latitude));
    const lngs = vehicles.map(v => Number(v.longitude));
    return [(Math.min(...lats)+Math.max(...lats))/2, (Math.min(...lngs)+Math.max(...lngs))/2];
  }, [vehicles]);

  return (
    <div style={{ height: '500px', width: '100%', position: 'relative' }}>
      <style>{LEAFLET_CSS}</style>
      <MapContainer
        center={center}
        zoom={9}
        style={{ height: '100%', width: '100%', background: '#1a1a1a' }}
        scrollWheelZoom
        zoomControl={true}
      >
        {/* OpenStreetMap padrão — sempre funciona, tema escuro via CSS */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <FlyToSelected vehicle={selected} />

        {vehicles.map(vehicle => (
          <Marker
            key={vehicle.codigo}
            position={[Number(vehicle.latitude), Number(vehicle.longitude)]}
            icon={makeIcon(vehicle.status, selected?.codigo === vehicle.codigo)}
            eventHandlers={{ click: () => onSelect(vehicle) }}
          >
            <Popup minWidth={200}>
              <div style={{ fontFamily: 'DM Sans, sans-serif', minWidth: '190px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px', color: '#f0f0f0' }}>
                  🚚 {vehicle.codigo}
                </div>
                <div style={{ fontSize: '11px', lineHeight: 1.8, color: '#ccc', marginBottom: '10px' }}>
                  <div><b style={{color:'#888'}}>Motorista:</b> {vehicle.motorista}</div>
                  <div><b style={{color:'#888'}}>Cidade:</b> {vehicle.cidade}</div>
                  <div><b style={{color:'#888'}}>Rota:</b> {vehicle.rota}</div>
                  <div><b style={{color:'#888'}}>Combustível:</b> {vehicle.combustivel}%</div>
                  <div><b style={{color:'#888'}}>Receita:</b> {fmtR(vehicle.receita)}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <StatusPill status={vehicle.status} />
                  {/* Botão Street View — abre Google Maps na localização */}
                  <button
                    onClick={() => openStreetView(vehicle.latitude, vehicle.longitude)}
                    style={{
                      background: '#1a73e8', border: 'none', borderRadius: '6px',
                      padding: '4px 10px', fontSize: '10px', color: '#fff',
                      cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    🧍 Street View
                  </button>
                  {/* Botão abrir no Google Maps */}
                  <button
                    onClick={() => openGoogleMaps(vehicle.latitude, vehicle.longitude, vehicle.codigo)}
                    style={{
                      background: '#34a853', border: 'none', borderRadius: '6px',
                      padding: '4px 10px', fontSize: '10px', color: '#fff',
                      cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    🗺️ Ver no Maps
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Badge de status sobreposto */}
      <div style={{ position:'absolute', top:12, left:12, zIndex:1000, background:'rgba(13,13,13,.9)', backdropFilter:'blur(8px)', border:'1px solid #2a2a2a', borderRadius:'10px', padding:'8px 14px', color:'#f0f0f0', fontSize:'11px', display:'flex', gap:'14px', pointerEvents:'none' }}>
        {Object.entries(vehicles.reduce((acc,v) => ({...acc,[v.status]:(acc[v.status]||0)+1}),{})).map(([status,count]) => (
          <span key={status} style={{ color: STATUS_STYLE[status]?.color||'#aaa', fontWeight:700 }}>{count} {status}</span>
        ))}
      </div>

      {/* Hint Street View */}
      <div style={{ position:'absolute', bottom:12, left:'50%', transform:'translateX(-50%)', zIndex:1000, background:'rgba(13,13,13,.85)', backdropFilter:'blur(6px)', border:'1px solid #2a2a2a', borderRadius:'8px', padding:'6px 14px', fontSize:'10px', color:'#666', pointerEvents:'none', whiteSpace:'nowrap' }}>
        🖱️ Clique num marcador para abrir Street View ou Google Maps
      </div>
    </div>
  );
}

export default function Frota() {
  const [vehicles, setVehicles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [source,   setSource]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/frota/painel');
      setVehicles(data.vehicles || []);
      setSelected(data.vehicles?.[0] || null);
      setSource(data.source || '');
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(v => [v.codigo, v.motorista, v.cidade, v.rota, v.status].join(' ').toLowerCase().includes(q));
  }, [vehicles, search]);

  const summary = useMemo(() => {
    const total   = filtered.length;
    const ativos  = filtered.filter(v => v.status !== 'Alerta').length;
    const alertas = filtered.filter(v => v.status === 'Alerta').length;
    const receita = filtered.reduce((a, v) => a + Number(v.receita || 0), 0);
    return { total, ativos, alertas, receita };
  }, [filtered]);

  function CombBar({ pct }) {
    const color = pct > 50 ? '#22c55e' : pct > 25 ? '#f59e0b' : '#C8102E';
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{ flex:1, height:'6px', background:'#2a2a2a', borderRadius:'3px', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:'3px', transition:'width .4s' }} />
        </div>
        <span style={{ fontSize:'11px', color, fontWeight:700, width:'32px' }}>{pct}%</span>
      </div>
    );
  }

  return (
    <>
      <div style={{ background:'#161616', borderBottom:'1px solid #1a1a1a', padding:'8px 24px', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'10px', color:'#666', textTransform:'uppercase', letterSpacing:'1px' }}>Painel:</span>
        <button onClick={load} style={{ background:'#C8102E', border:'1px solid #C8102E', borderRadius:'20px', padding:'4px 12px', fontSize:'11px', color:'#fff', cursor:'pointer' }}>
          Atualizar frota
        </button>
        <span style={{ fontSize:'10px', color:'#666', marginLeft:'8px' }}>Origem:</span>
        <span style={{ fontSize:'11px', color: source==='database'?'#22c55e':'#f59e0b' }}>
          {source==='database'?'🟢 Banco real':'🟡 Dados de fallback'}
        </span>
        <div style={{ marginLeft:'auto' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Buscar veículo, motorista, cidade ou rota..."
            style={{ background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:'6px', padding:'7px 12px', fontSize:'12px', color:'#f0f0f0', width:'320px', maxWidth:'100%' }} />
        </div>
      </div>

      <div style={{ padding:'18px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {loading ? <Loading /> : (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
              <KpiCard icon='🚚' label='Veículos rastreados' value={fmt(summary.total)}    meta='Total no painel atual'          color='red'    prog={summary.total?100:0} />
              <KpiCard icon='📡' label='Unidades ativas'     value={fmt(summary.ativos)}   meta={`${fmt(summary.alertas)} em alerta`} color='green'  prog={summary.total?(summary.ativos/summary.total)*100:0} />
              <KpiCard icon='💰' label='Receita operacional' value={fmtR(summary.receita)} meta='Janela atual do painel'          color='teal'   prog={70} />
              <KpiCard icon='⚠️' label='Alertas críticos'    value={fmt(summary.alertas)}  meta='Veículos exigindo atenção'       color='orange' prog={summary.total?(summary.alertas/summary.total)*100:0} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1.7fr 1fr', gap:'12px' }}>
              <Card style={{ padding:0, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px 0' }}>
                  <CardTitle right={<span style={{ fontSize:'11px', color:'#666' }}>{filtered.length} veículo(s)</span>}>
                    Mapa do Motor
                  </CardTitle>
                </div>
                {filtered.length > 0
                  ? <FleetMap vehicles={filtered} selected={selected} onSelect={setSelected} />
                  : <div style={{ height:'500px', display:'flex', alignItems:'center', justifyContent:'center', color:'#666' }}>Nenhum veículo encontrado</div>
                }
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', padding:'14px 16px', borderTop:'1px solid #1a1a1a' }}>
                  <div style={miniCard}><div style={miniLabel}>Último sinal</div><div style={miniValue}>{selected?.ultimo_sinal||'—'}</div></div>
                  <div style={miniCard}><div style={miniLabel}>Cobertura ativa</div><div style={miniValue}>{summary.total?fmt((summary.ativos/summary.total)*100,1):'0,0'}%</div></div>
                  <div style={miniCard}><div style={miniLabel}>Status atual</div><div style={miniValue}>{selected?.status||'—'}</div></div>
                </div>
              </Card>

              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <Card>
                  <CardTitle>Detalhes do veículo</CardTitle>
                  {selected ? (
                    <div style={{ display:'grid', gap:'10px' }}>
                      <Detail label='Código'    value={selected.codigo}    mono />
                      <Detail label='Motorista' value={selected.motorista} />
                      <Detail label='Cidade'    value={selected.cidade} />
                      <Detail label='Rota'      value={selected.rota} />
                      <div style={{ paddingBottom:'8px', borderBottom:'1px solid #1f1f1f' }}>
                        <div style={{ fontSize:'10px', color:'#666', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Combustível</div>
                        <CombBar pct={selected.combustivel} />
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'10px', color:'#666', textTransform:'uppercase', letterSpacing:'1px' }}>Status</span>
                        <StatusPill status={selected.status} />
                      </div>
                      {/* Botões de navegação no painel lateral */}
                      <div style={{ display:'flex', gap:'6px', paddingTop:'4px' }}>
                        <button onClick={() => openStreetView(selected.latitude, selected.longitude)}
                          style={{ flex:1, background:'#1a73e8', border:'none', borderRadius:'6px', padding:'8px', fontSize:'11px', color:'#fff', cursor:'pointer', fontWeight:700 }}>
                          🧍 Street View
                        </button>
                        <button onClick={() => openGoogleMaps(selected.latitude, selected.longitude, selected.codigo)}
                          style={{ flex:1, background:'#34a853', border:'none', borderRadius:'6px', padding:'8px', fontSize:'11px', color:'#fff', cursor:'pointer', fontWeight:700 }}>
                          🗺️ Google Maps
                        </button>
                      </div>
                    </div>
                  ) : <div style={{ color:'#666', fontSize:'12px' }}>Selecione um veículo no mapa.</div>}
                </Card>

                <Card>
                  <CardTitle>Distribuição por cidade</CardTitle>
                  <div style={{ display:'grid', gap:'8px' }}>
                    {Object.entries(filtered.reduce((acc,v) => ({...acc,[v.cidade]:(acc[v.cidade]||0)+1}),{}))
                      .sort((a,b)=>b[1]-a[1])
                      .map(([cidade, total]) => {
                        const pct = Math.round((total/filtered.length)*100);
                        return (
                          <div key={cidade} style={{ padding:'10px 12px', background:'#1f1f1f', border:'1px solid #222', borderRadius:'8px', cursor:'pointer' }}
                            onClick={() => { const v=filtered.find(v=>v.cidade===cidade); if(v) setSelected(v); }}>
                            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
                              <span style={{ fontSize:'12px' }}>{cidade}</span>
                              <strong style={{ fontSize:'12px' }}>{total}</strong>
                            </div>
                            <div style={{ height:'3px', background:'#2a2a2a', borderRadius:'2px', overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${pct}%`, background:'#C8102E', borderRadius:'2px' }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </Card>
              </div>
            </div>

            <Card>
              <CardTitle right={<span style={{ fontSize:'11px', color:'#666' }}>Feed operacional</span>}>Veículos ao vivo</CardTitle>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
                  <thead><tr>
                    {['Código','Motorista','Cidade','Rota','Combustível','Último sinal','Receita','Status','Navegação'].map(h=>(
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.map(v => (
                      <tr key={v.codigo} style={{ borderBottom:'1px solid #171717', cursor:'pointer', background:selected?.codigo===v.codigo?'rgba(200,16,46,.06)':'transparent' }} onClick={()=>setSelected(v)}>
                        <td style={{...TD,fontFamily:'monospace',color:'#bbb'}}>{v.codigo}</td>
                        <td style={TD}>{v.motorista}</td>
                        <td style={TD}>{v.cidade}</td>
                        <td style={TD}>{v.rota}</td>
                        <td style={{...TD,width:'120px'}}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            <div style={{ flex:1, height:'4px', background:'#2a2a2a', borderRadius:'2px', overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${v.combustivel}%`, background:v.combustivel>50?'#22c55e':v.combustivel>25?'#f59e0b':'#C8102E', borderRadius:'2px' }} />
                            </div>
                            <span style={{ fontSize:'10px', color:'#888', width:'28px' }}>{v.combustivel}%</span>
                          </div>
                        </td>
                        <td style={{...TD,color:'#888'}}>{v.ultimo_sinal}</td>
                        <td style={TD}>{fmtR(v.receita)}</td>
                        <td style={TD}><StatusPill status={v.status} /></td>
                        <td style={TD} onClick={e=>e.stopPropagation()}>
                          <div style={{ display:'flex', gap:'4px' }}>
                            <button onClick={()=>openStreetView(v.latitude,v.longitude)}
                              title="Street View" style={{ background:'#1a73e8', border:'none', borderRadius:'4px', padding:'3px 7px', fontSize:'10px', color:'#fff', cursor:'pointer' }}>
                              🧍
                            </button>
                            <button onClick={()=>openGoogleMaps(v.latitude,v.longitude,v.codigo)}
                              title="Google Maps" style={{ background:'#34a853', border:'none', borderRadius:'4px', padding:'3px 7px', fontSize:'10px', color:'#fff', cursor:'pointer' }}>
                              🗺️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

function Detail({ label, value, mono=false }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', paddingBottom:'8px', borderBottom:'1px solid #1f1f1f' }}>
      <span style={{ fontSize:'10px', color:'#666', textTransform:'uppercase', letterSpacing:'1px' }}>{label}</span>
      <strong style={{ fontSize:'12px', fontFamily:mono?'monospace':'inherit' }}>{value}</strong>
    </div>
  );
}

const miniCard  = { background:'#1f1f1f', border:'1px solid #222', borderRadius:'8px', padding:'10px 12px' };
const miniLabel = { fontSize:'10px', color:'#666', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:'4px' };
const miniValue = { fontSize:'13px', fontWeight:700 };
const TH = { background:'#1f1f1f', textAlign:'left', fontSize:'10px', textTransform:'uppercase', letterSpacing:'.8px', color:'#666', padding:'8px 10px', borderBottom:'1px solid #222', fontWeight:500, whiteSpace:'nowrap' };
const TD = { padding:'8px 10px', color:'#f0f0f0', whiteSpace:'nowrap' };
