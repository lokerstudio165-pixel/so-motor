// src/pages/MapaClientes.jsx — Mapa interativo de clientes
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { Card, CardTitle, Loading } from '../components/UI';

const LEAFLET_CSS = `
  .leaflet-container{background:#111!important;font-family:'DM Sans',sans-serif!important}
  .leaflet-tile{background:#111}
  .leaflet-tile-loaded{background:transparent}
  .leaflet-control-zoom{border:1px solid #2a2a2a!important;box-shadow:none!important}
  .leaflet-control-zoom a{background:#161616!important;color:#f0f0f0!important;border-color:#2a2a2a!important;width:30px!important;height:30px!important;line-height:30px!important;font-size:16px!important}
  .leaflet-control-zoom a:hover{background:#C8102E!important;color:#fff!important}
  .leaflet-popup-content-wrapper{background:#1a1a1a!important;border:1px solid #2a2a2a!important;border-radius:12px!important;color:#f0f0f0!important;box-shadow:0 8px 40px rgba(0,0,0,.85)!important;min-width:230px}
  .leaflet-popup-tip{background:#1a1a1a!important}
  .leaflet-popup-close-button{color:#555!important;font-size:16px!important;top:8px!important;right:8px!important}
  .leaflet-control-attribution{background:rgba(13,13,13,.8)!important;color:#333!important;font-size:9px!important}
  .leaflet-control-attribution a{color:#555!important}
`;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SEGMENTO_COR = {
  'Oficina Mecânica': '#3b82f6',
  'Transportadora':   '#22c55e',
  'Distribuidor':     '#f59e0b',
  'Loja de Autopeças':'#a855f7',
  'Agronegócio':      '#14b8a6',
  'Borracharia':      '#f97316',
};
const COR_DEFAULT = '#6b7280';

const STATUS_STYLE = {
  Ativo:   { bg:'rgba(34,197,94,.15)',  cor:'#22c55e' },
  Inativo: { bg:'rgba(107,114,128,.15)',cor:'#6b7280' },
};

const fmt  = (n,d=0) => n==null||isNaN(n)?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtR = (n) => n==null||isNaN(n)?'—':'R$ '+fmt(n,0);

function makeIcon(segmento, status, isSel) {
  const cor   = status==='Inativo' ? '#444' : (SEGMENTO_COR[segmento]||COR_DEFAULT);
  const size  = isSel ? 44 : 32;
  const emoji = status==='Inativo' ? '⚫' :
    segmento==='Transportadora'   ? '🚛' :
    segmento==='Distribuidor'     ? '🏬' :
    segmento==='Agronegócio'      ? '🚜' :
    segmento==='Borracharia'      ? '🔧' :
    segmento==='Loja de Autopeças'? '🛒' : '🔩';
  const glow = isSel
    ? `0 0 0 8px ${cor}44,0 0 24px ${cor}88,0 4px 16px rgba(0,0,0,.8)`
    : `0 0 0 3px ${cor}33,0 3px 10px rgba(0,0,0,.6)`;
  const html = `<div style="width:${size}px;height:${size}px;background:${cor};border:${isSel?'3px':'2px'} solid rgba(255,255,255,${isSel?.7:.4});border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${isSel?18:13}px;box-shadow:${glow};cursor:pointer;transition:all .2s;">${emoji}</div>`;
  return L.divIcon({ className:'', html, iconSize:[size,size], iconAnchor:[size/2,size/2], popupAnchor:[0,-size/2-6] });
}

function FlyTo({ cliente }) {
  const map = useMap();
  useEffect(() => {
    if (cliente?.latitude && cliente?.longitude)
      map.flyTo([Number(cliente.latitude), Number(cliente.longitude)], 13, { duration:1.0 });
  }, [cliente]);
  return null;
}

function FitBounds({ clientes }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !clientes.length) return;
    const pts = clientes.filter(c=>c.latitude&&c.longitude).map(c=>[Number(c.latitude),Number(c.longitude)]);
    if (pts.length) { map.fitBounds(L.latLngBounds(pts), { padding:[40,40] }); done.current = true; }
  }, [clientes]);
  return null;
}

// ─── Modal de cadastro/edição ─────────────────────────────────
function ModalCliente({ cliente, filiais, onSave, onClose }) {
  const [form, setForm] = useState(cliente || {
    nome:'', documento:'', telefone:'', email:'', cidade:'', estado:'',
    filial_ref:'', latitude:'', longitude:'', segmento:'Oficina Mecânica',
    status:'Ativo', total_compras_6m:0, total_compras_mes:0, ticket_medio:0, observacao:''
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p => ({...p,[k]:v}));

  async function salvar() {
    if (!form.nome.trim()) return alert('Nome é obrigatório.');
    setSaving(true);
    try {
      if (form.id) await api.put(`/clientes/${form.id}`, form);
      else         await api.post('/clientes', form);
      onSave();
    } catch(e) { alert('Erro: '+e.message); }
    finally { setSaving(false); }
  }

  const inp = { background:'#111', border:'1px solid #2a2a2a', borderRadius:7, padding:'8px 12px', color:'#f0f0f0', fontSize:12, width:'100%', boxSizing:'border-box' };
  const lbl = { fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:1, marginBottom:4, display:'block' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:14, padding:'24px 28px', width:'100%', maxWidth:600, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ margin:0, fontFamily:'Bebas Neue', fontSize:22, letterSpacing:2, color:'#f0f0f0' }}>
            {form.id ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#666', fontSize:22, cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[
            { k:'nome',             l:'Nome / Razão Social', full:true },
            { k:'documento',        l:'CNPJ / CPF' },
            { k:'telefone',         l:'Telefone' },
            { k:'email',            l:'E-mail' },
            { k:'cidade',           l:'Cidade' },
            { k:'estado',           l:'UF' },
            { k:'latitude',         l:'Latitude' },
            { k:'longitude',        l:'Longitude' },
            { k:'total_compras_6m', l:'Compras 6m (R$)' },
            { k:'total_compras_mes',l:'Compras Mês (R$)' },
            { k:'ticket_medio',     l:'Ticket Médio (R$)' },
          ].map(f => (
            <div key={f.k} style={{ gridColumn: f.full?'span 2':'auto' }}>
              <label style={lbl}>{f.l}</label>
              <input style={inp} value={form[f.k]||''} onChange={e=>set(f.k, e.target.value)} />
            </div>
          ))}

          <div>
            <label style={lbl}>Filial de Referência</label>
            <select style={{...inp}} value={form.filial_ref||''} onChange={e=>set('filial_ref',e.target.value)}>
              <option value="">— Selecione —</option>
              {filiais.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Segmento</label>
            <select style={{...inp}} value={form.segmento||''} onChange={e=>set('segmento',e.target.value)}>
              {Object.keys(SEGMENTO_COR).map(s=><option key={s}>{s}</option>)}
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Status</label>
            <select style={{...inp}} value={form.status||'Ativo'} onChange={e=>set('status',e.target.value)}>
              <option>Ativo</option><option>Inativo</option>
            </select>
          </div>
          <div style={{ gridColumn:'span 2' }}>
            <label style={lbl}>Observação</label>
            <textarea style={{...inp,resize:'vertical',minHeight:60}} value={form.observacao||''} onChange={e=>set('observacao',e.target.value)} />
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:8, padding:'9px 20px', color:'#888', fontSize:12, cursor:'pointer' }}>Cancelar</button>
          <button onClick={salvar} disabled={saving} style={{ background:'#C8102E', border:'none', borderRadius:8, padding:'9px 24px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────
export default function MapaClientes() {
  const [clientes,     setClientes]     = useState([]);
  const [kpis,         setKpis]         = useState(null);
  const [porFilial,    setPorFilial]     = useState([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [modal,        setModal]        = useState(null);  // null | {} | cliente
  const [confirmDel,   setConfirmDel]   = useState(null);

  // Filtros
  const [busca,        setBusca]        = useState('');
  const [filialFil,    setFilialFil]    = useState('');
  const [statusFil,    setStatusFil]    = useState('');
  const [segFil,       setSegFil]       = useState('');
  const [viewMode,     setViewMode]     = useState('mapa'); // 'mapa' | 'lista'

  const filiais = useMemo(() => [...new Set(clientes.map(c=>c.filial_ref).filter(Boolean))].sort(), [clientes]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit:500 };
      if (filialFil) params.filial = filialFil;
      if (statusFil) params.status = statusFil;
      if (busca)     params.search = busca;
      const [c, k, pf] = await Promise.all([
        api.get('/clientes',          { params }),
        api.get('/clientes/kpis'),
        api.get('/clientes/por-filial'),
      ]);
      setClientes(c.data.rows || []);
      setTotal(c.data.total   || 0);
      setKpis(k.data);
      setPorFilial(pf.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [busca, filialFil, statusFil]);

  useEffect(() => { load(); }, [load]);

  const filtrados = useMemo(() => {
    let lista = clientes;
    if (segFil)  lista = lista.filter(c => c.segmento === segFil);
    return lista.filter(c => c.latitude && c.longitude);
  }, [clientes, segFil]);

  async function excluir(id) {
    try { await api.delete(`/clientes/${id}`); setConfirmDel(null); load(); } catch(e) { alert(e.message); }
  }

  const segmentos = useMemo(() => [...new Set(clientes.map(c=>c.segmento).filter(Boolean))].sort(), [clientes]);

  return (
    <div style={{ padding:'18px 24px', display:'flex', flexDirection:'column', gap:16 }}>
      {modal !== null && (
        <ModalCliente
          cliente={modal.id ? modal : null}
          filiais={filiais.length ? filiais : ['PRZ','NAB','SCR','PET','AJU','SAL','FEI','CGR','CRU','ARP','IPS','MCO','PAR','FZA','SJP','SMP','VMA','0NN']}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
      {confirmDel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:12, padding:'28px 32px', textAlign:'center', maxWidth:360 }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🗑️</div>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>Excluir cliente?</div>
            <div style={{ fontSize:12, color:'#666', marginBottom:20 }}>{confirmDel.nome}</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={()=>setConfirmDel(null)} style={{ background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:8, padding:'9px 20px', color:'#888', fontSize:12, cursor:'pointer' }}>Cancelar</button>
              <button onClick={()=>excluir(confirmDel.id)} style={{ background:'#C8102E', border:'none', borderRadius:8, padding:'9px 20px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cabeçalho ─────────────────────────────────────────── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'Bebas Neue', fontSize:28, letterSpacing:2, color:'#f0f0f0', margin:0 }}>MAPA DOS CLIENTES</h1>
          <div style={{ fontSize:11, color:'#555', marginTop:2 }}>{total} clientes cadastrados · {filtrados.length} exibidos no mapa</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {/* Tabs mapa/lista */}
          {['mapa','lista'].map(v => (
            <button key={v} onClick={()=>setViewMode(v)}
              style={{ background: viewMode===v?'rgba(200,16,46,.18)':'#1f1f1f', border:`1px solid ${viewMode===v?'rgba(200,16,46,.5)':'#2a2a2a'}`, borderRadius:8, padding:'8px 16px', color:viewMode===v?'#C8102E':'#888', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              {v==='mapa'?'🗺️ Mapa':'📋 Lista'}
            </button>
          ))}
          <button onClick={()=>setModal({})}
            style={{ background:'#C8102E', border:'none', borderRadius:8, padding:'8px 18px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            + Novo Cliente
          </button>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      {kpis && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:10 }}>
          {[
            { icon:'👥', label:'Total',          value: fmt(kpis.total_clientes) },
            { icon:'✅', label:'Ativos',          value: fmt(kpis.ativos) },
            { icon:'🚫', label:'Inativos',        value: fmt(kpis.inativos) },
            { icon:'💰', label:'Volume 6m',       value: 'R$'+fmt(kpis.volume_6m/1e3,0)+'K' },
            { icon:'📅', label:'Volume Mês',      value: 'R$'+fmt(kpis.volume_mes/1e3,0)+'K' },
            { icon:'🎫', label:'Ticket Médio',    value: fmtR(kpis.ticket_medio) },
            { icon:'🏙️', label:'Cidades',         value: fmt(kpis.cidades) },
          ].map(k => (
            <div key={k.label} style={{ background:'#161616', border:'1px solid #1e1e1e', borderRadius:10, padding:'12px 14px' }}>
              <div style={{ fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:1.2, marginBottom:4 }}>{k.icon} {k.label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:'#f0f0f0', fontFamily:'monospace' }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filtros ───────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', background:'#111', border:'1px solid #1a1a1a', borderRadius:10, padding:'12px 16px' }}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar por nome, cidade ou doc..."
          style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:7, padding:'7px 12px', color:'#f0f0f0', fontSize:12, width:230 }} />
        <select value={filialFil} onChange={e=>setFilialFil(e.target.value)}
          style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:7, padding:'7px 12px', color:filialFil?'#f0f0f0':'#555', fontSize:12 }}>
          <option value="">🏪 Todas as filiais</option>
          {filiais.map(f=><option key={f} value={f}>{f}</option>)}
        </select>
        <select value={segFil} onChange={e=>setSegFil(e.target.value)}
          style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:7, padding:'7px 12px', color:segFil?'#f0f0f0':'#555', fontSize:12 }}>
          <option value="">🏷️ Todos os segmentos</option>
          {segmentos.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFil} onChange={e=>setStatusFil(e.target.value)}
          style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:7, padding:'7px 12px', color:statusFil?'#f0f0f0':'#555', fontSize:12 }}>
          <option value="">⚡ Qualquer status</option>
          <option value="Ativo">✅ Ativo</option>
          <option value="Inativo">🚫 Inativo</option>
        </select>
        {(busca||filialFil||segFil||statusFil) && (
          <button onClick={()=>{setBusca('');setFilialFil('');setSegFil('');setStatusFil('');}}
            style={{ background:'rgba(200,16,46,.12)', border:'1px solid rgba(200,16,46,.35)', borderRadius:7, padding:'7px 14px', color:'#C8102E', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            ✕ Limpar
          </button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:6, flexWrap:'wrap' }}>
          {Object.entries(SEGMENTO_COR).map(([seg,cor]) => (
            <span key={seg} onClick={()=>setSegFil(s=>s===seg?'':seg)}
              style={{ cursor:'pointer', fontSize:10, color: segFil===seg?'#fff':cor, background: segFil===seg?cor:`${cor}18`, border:`1px solid ${cor}44`, borderRadius:20, padding:'3px 10px', transition:'all .15s' }}>
              ● {seg}
            </span>
          ))}
        </div>
      </div>

      {loading ? <Loading /> : (
        viewMode === 'mapa' ? (
          /* ── VIEW MAPA ─────────────────────────────────────── */
          <div style={{ display:'grid', gridTemplateColumns:'1fr 310px', gap:14 }}>
            <Card style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'14px 18px 10px' }}>
                <CardTitle>{filtrados.length} clientes no mapa</CardTitle>
              </div>
              <div style={{ height:560, position:'relative' }}>
                <style>{LEAFLET_CSS}</style>
                <MapContainer center={[-8.5,-38.5]} zoom={5} style={{ height:'100%', width:'100%' }} scrollWheelZoom>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                  />
                  <FlyTo cliente={selected} />
                  <FitBounds clientes={filtrados} />
                  {filtrados.map(c => (
                    <Marker
                      key={c.id}
                      position={[Number(c.latitude), Number(c.longitude)]}
                      icon={makeIcon(c.segmento, c.status, selected?.id===c.id)}
                      eventHandlers={{ click:()=>setSelected(c) }}
                    >
                      <Popup minWidth={230}>
                        <div style={{ fontFamily:'DM Sans,sans-serif', padding:'4px 0' }}>
                          <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:10 }}>
                            <div style={{ width:10, height:10, borderRadius:'50%', background:SEGMENTO_COR[c.segmento]||COR_DEFAULT, flexShrink:0, marginTop:3 }} />
                            <div>
                              <div style={{ fontWeight:800, fontSize:13, color:'#f0f0f0', lineHeight:1.3 }}>{c.nome}</div>
                              <div style={{ fontSize:10, color:'#555', marginTop:2 }}>{c.segmento} · {c.cidade}/{c.estado}</div>
                            </div>
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:10 }}>
                            {[
                              { l:'Compras 6m',  v:fmtR(c.total_compras_6m) },
                              { l:'Ticket Médio',v:fmtR(c.ticket_medio) },
                              { l:'Filial',      v:c.filial_ref||'—' },
                              { l:'Status',      v:c.status },
                            ].map(m=>(
                              <div key={m.l} style={{ background:'#111', borderRadius:5, padding:'5px 8px' }}>
                                <div style={{ fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:.8 }}>{m.l}</div>
                                <div style={{ fontSize:11, fontWeight:700, color:'#ddd', fontFamily:'monospace' }}>{m.v}</div>
                              </div>
                            ))}
                          </div>
                          {c.observacao && <div style={{ fontSize:10, color:'#666', fontStyle:'italic', borderTop:'1px solid #222', paddingTop:6 }}>{c.observacao}</div>}
                          <div style={{ display:'flex', gap:6, marginTop:8 }}>
                            <button onClick={()=>setModal(c)} style={{ flex:1, background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:6, padding:'5px', fontSize:10, color:'#aaa', cursor:'pointer' }}>✏️ Editar</button>
                            <button onClick={()=>setConfirmDel(c)} style={{ background:'rgba(200,16,46,.12)', border:'1px solid rgba(200,16,46,.3)', borderRadius:6, padding:'5px 10px', fontSize:10, color:'#C8102E', cursor:'pointer' }}>🗑️</button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
                {/* Legenda sobreposta */}
                <div style={{ position:'absolute', bottom:14, left:14, zIndex:1000, background:'rgba(13,13,13,.92)', backdropFilter:'blur(8px)', border:'1px solid #2a2a2a', borderRadius:10, padding:'10px 14px' }}>
                  {Object.entries(SEGMENTO_COR).map(([seg,cor])=>(
                    <div key={seg} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:cor }} />
                      <span style={{ fontSize:10, color:'#888' }}>{seg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Painel lateral */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {selected && (
                <Card>
                  <CardTitle>Cliente Selecionado</CardTitle>
                  <div style={{ marginTop:10 }}>
                    <div style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:14 }}>
                      <div style={{ width:38, height:38, borderRadius:'50%', background:SEGMENTO_COR[selected.segmento]||COR_DEFAULT, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                        {selected.status==='Inativo'?'⚫':selected.segmento==='Transportadora'?'🚛':selected.segmento==='Distribuidor'?'🏬':selected.segmento==='Agronegócio'?'🚜':'🔩'}
                      </div>
                      <div>
                        <div style={{ fontWeight:800, fontSize:14, color:'#fff', lineHeight:1.3 }}>{selected.nome}</div>
                        <div style={{ fontSize:10, color:'#555', marginTop:2 }}>{selected.segmento}</div>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, ...(STATUS_STYLE[selected.status]||{}) }}>
                          {selected.status}
                        </span>
                      </div>
                    </div>
                    {[
                      { l:'Documento',     v: selected.documento    },
                      { l:'Telefone',      v: selected.telefone     },
                      { l:'E-mail',        v: selected.email        },
                      { l:'Cidade / UF',   v: `${selected.cidade||'—'} / ${selected.estado||'—'}` },
                      { l:'Filial',        v: selected.filial_ref   },
                      { l:'Compras 6m',    v: fmtR(selected.total_compras_6m) },
                      { l:'Compras Mês',   v: fmtR(selected.total_compras_mes) },
                      { l:'Ticket Médio',  v: fmtR(selected.ticket_medio) },
                    ].map(d => (
                      <div key={d.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #1a1a1a' }}>
                        <span style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:.8 }}>{d.l}</span>
                        <strong style={{ fontSize:11, fontFamily:'monospace', color:'#ddd', maxWidth:160, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.v||'—'}</strong>
                      </div>
                    ))}
                    {selected.observacao && (
                      <div style={{ marginTop:8, fontSize:11, color:'#666', fontStyle:'italic', background:'#111', borderRadius:6, padding:'8px 10px' }}>{selected.observacao}</div>
                    )}
                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      <button onClick={()=>setModal(selected)} style={{ flex:1, background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:8, padding:'8px', fontSize:11, color:'#aaa', cursor:'pointer', fontWeight:700 }}>✏️ Editar</button>
                      <button onClick={()=>setConfirmDel(selected)} style={{ background:'rgba(200,16,46,.1)', border:'1px solid rgba(200,16,46,.3)', borderRadius:8, padding:'8px 14px', fontSize:11, color:'#C8102E', cursor:'pointer' }}>🗑️</button>
                    </div>
                  </div>
                </Card>
              )}

              <Card>
                <CardTitle>Volume por Filial</CardTitle>
                <div style={{ marginTop:10 }}>
                  {porFilial.slice(0,8).map((f,i) => {
                    const max = porFilial[0]?.volume_6m||1;
                    const pct = ((f.volume_6m||0)/max*100).toFixed(1);
                    return (
                      <div key={f.filial_ref} style={{ marginBottom:8, cursor:'pointer' }}
                        onClick={()=>setFilialFil(ff=>ff===f.filial_ref?'':f.filial_ref)}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                          <span style={{ fontSize:11, fontWeight:700, color: filialFil===f.filial_ref?'#C8102E':'#ddd' }}>{f.filial_ref}</span>
                          <span style={{ fontSize:10, color:'#555', fontFamily:'monospace' }}>R${fmt(f.volume_6m/1e3,0)}K · {fmt(f.total)} cli</span>
                        </div>
                        <div style={{ height:4, background:'#1a1a1a', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: filialFil===f.filial_ref?'#C8102E':'#3b82f6', borderRadius:2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        ) : (
          /* ── VIEW LISTA ────────────────────────────────────── */
          <Card>
            <CardTitle right={<button onClick={()=>setModal({})} style={{ background:'#C8102E', border:'none', borderRadius:7, padding:'6px 14px', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>+ Novo</button>}>
              Lista de Clientes — {clientes.length} registros
            </CardTitle>
            <div style={{ overflowX:'auto', marginTop:10 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead><tr>
                  {['Cliente','Documento','Cidade/UF','Filial','Segmento','Compras 6m','Ticket Médio','Status','Ações'].map(h=>(
                    <th key={h} style={{ background:'#1f1f1f', textAlign:'left', fontSize:10, textTransform:'uppercase', letterSpacing:.8, color:'#666', padding:'8px 10px', borderBottom:'1px solid #222', fontWeight:500, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {clientes.map(c => (
                    <tr key={c.id} style={{ borderBottom:'1px solid #171717', cursor:'pointer', background:selected?.id===c.id?'rgba(200,16,46,.05)':'transparent' }} onClick={()=>{ setSelected(c); setViewMode('mapa'); }}>
                      <td style={{ padding:'8px 10px', color:'#f0f0f0', whiteSpace:'nowrap', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                          <div style={{ width:7, height:7, borderRadius:'50%', background:SEGMENTO_COR[c.segmento]||COR_DEFAULT, flexShrink:0 }} />
                          {c.nome}
                        </div>
                      </td>
                      <td style={{ padding:'8px 10px', color:'#888', fontFamily:'monospace', whiteSpace:'nowrap' }}>{c.documento||'—'}</td>
                      <td style={{ padding:'8px 10px', color:'#aaa', whiteSpace:'nowrap' }}>{c.cidade||'—'}/{c.estado||'—'}</td>
                      <td style={{ padding:'8px 10px', color:'#f59e0b', fontWeight:700 }}>{c.filial_ref||'—'}</td>
                      <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                        <span style={{ fontSize:10, color:SEGMENTO_COR[c.segmento]||COR_DEFAULT, background:`${SEGMENTO_COR[c.segmento]||COR_DEFAULT}18`, border:`1px solid ${SEGMENTO_COR[c.segmento]||COR_DEFAULT}33`, borderRadius:20, padding:'2px 8px' }}>{c.segmento||'—'}</span>
                      </td>
                      <td style={{ padding:'8px 10px', fontFamily:'monospace', color:'#f0f0f0', whiteSpace:'nowrap' }}>{fmtR(c.total_compras_6m)}</td>
                      <td style={{ padding:'8px 10px', fontFamily:'monospace', color:'#aaa', whiteSpace:'nowrap' }}>{fmtR(c.ticket_medio)}</td>
                      <td style={{ padding:'8px 10px' }}>
                        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, ...(STATUS_STYLE[c.status]||{}) }}>{c.status}</span>
                      </td>
                      <td style={{ padding:'8px 10px' }} onClick={e=>e.stopPropagation()}>
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={()=>setModal(c)} style={{ background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:5, padding:'4px 8px', fontSize:10, color:'#aaa', cursor:'pointer' }}>✏️</button>
                          <button onClick={()=>setConfirmDel(c)} style={{ background:'rgba(200,16,46,.1)', border:'1px solid rgba(200,16,46,.3)', borderRadius:5, padding:'4px 8px', fontSize:10, color:'#C8102E', cursor:'pointer' }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}
    </div>
  );
}
