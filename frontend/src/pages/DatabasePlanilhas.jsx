// frontend/src/pages/DatabasePlanilhas.jsx
import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('sm_token');
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro desconhecido');
  return data;
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function DatabasePlanilhas() {
  const [tab, setTab] = useState('fontes');

  // Estado SQL — persiste entre abas
  const [pgStatus, setPgStatus] = useState(null);

  // Estado planilha — persiste entre abas
  const [sheets,      setSheets]      = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [fileName,    setFileName]    = useState('');

  // Flags de limpeza — controlam exibição no PanelFontes
  const [pgLimpo,     setPgLimpo]     = useState(false);
  const [sheetLimpa,  setSheetLimpa]  = useState(false);

  // ─── Limpar dados reais do banco ───────────────────────────────────────────
  const [clearing, setClearing] = useState(false);
  const [clearMsg,  setClearMsg]  = useState('');

  async function clearTabelas() {
    setClearing(true);
    setClearMsg('');
    try {
      const data = await apiFetch('/database/reset-dados', {
        method: 'DELETE',
      });
      setClearMsg(`✓ ${data.message}`);
      // Reseta estados visuais
      setPgStatus(null);
      setPgLimpo(true);
      setSheets([]);
      setFileName('');
      setActiveSheet(0);
      setSheetLimpa(true);
    } catch (e) {
      setClearMsg(`✗ Erro: ${e.message}`);
    } finally {
      setClearing(false);
      setTimeout(() => setClearMsg(''), 6000);
    }
  }

  function handleClearPg() {
    clearTabelas();
  }
  function handleClearSheet() {
    setSheets([]);
    setFileName('');
    setActiveSheet(0);
    setSheetLimpa(true);
  }
  // Estado Filiais
  const [filiaisImportadas, setFiliaisImportadas] = useState(false);
  const [filiaisCount,      setFiliaisCount]      = useState(0);

  // Quando novos dados chegam, reseta as flags
  useEffect(() => { if (pgStatus && pgLimpo) setPgLimpo(false); }, [pgStatus, pgLimpo]);
  useEffect(() => { if (fileName && sheetLimpa) setSheetLimpa(false); }, [fileName, sheetLimpa]);

  return (
    <div style={S.page}>
      {/* TABS */}
      <div style={S.tabBar}>
        <TabBtn active={tab === 'fontes'}  onClick={() => setTab('fontes')}>
          🔌 &nbsp;Fontes de Dados
        </TabBtn>
        <TabBtn active={tab === 'sql'}     onClick={() => setTab('sql')}>
          🗄️ &nbsp;Banco de Dados
          {pgStatus && <Pill color="#2ecc8a">ON</Pill>}
        </TabBtn>
        <TabBtn active={tab === 'sheets'}  onClick={() => setTab('sheets')}>
          📊 &nbsp;Planilhas
          {sheets.length > 0 && (
            <Pill color="#C8102E">{fileName.length > 14 ? fileName.slice(0,14)+'…' : fileName}</Pill>
          )}
        </TabBtn>
        <TabBtn active={tab === 'filiais'} onClick={() => setTab('filiais')}>
          🏪 &nbsp;Lojas / Filiais
          {filiaisImportadas && <Pill color="#f39c12">{filiaisCount}</Pill>}
        </TabBtn>
      </div>

      {/* CONTEÚDO — todos montados, só visibilidade alterna */}
      <div style={S.content}>
        <div style={{ display: tab === 'fontes' ? 'block' : 'none' }}>
          <PanelFontes pgStatus={pgStatus} pgLimpo={pgLimpo} sheetLimpa={sheetLimpa} clearing={clearing} clearMsg={clearMsg} onClearTabelas={clearTabelas} />
        </div>
        <div style={{ display: tab === 'sql' ? 'block' : 'none' }}>
          <PanelSQL pgStatus={pgStatus} setPgStatus={setPgStatus} />
        </div>
        <div style={{ display: tab === 'sheets' ? 'block' : 'none' }}>
          <PanelSheets
            sheets={sheets}           setSheets={setSheets}
            activeSheet={activeSheet} setActiveSheet={setActiveSheet}
            fileName={fileName}       setFileName={setFileName}
            onClearSheet={handleClearSheet}
          />
        </div>
        <div style={{ display: tab === 'filiais' ? 'block' : 'none' }}>
          <PanelFiliais
            onImported={(count) => { setFiliaisImportadas(true); setFiliaisCount(count); }}
          />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAINEL FONTES DE DADOS
═══════════════════════════════════════════════════════════ */
const FONTES_DEFAULT = [
  { id:'postgresql', icon:'🐘', nome:'PostgreSQL',    tipo:'Banco de Dados', status:'idle',     detalhe:'Não verificado ainda',     info:'Vá em "Banco de Dados" e clique em Verificar Status' },
  { id:'planilha',   icon:'📊', nome:'Planilha Local',tipo:'Excel / CSV',    status:'idle',     detalhe:'Nenhum arquivo importado',  info:'Vá em "Planilhas" e importe um arquivo .xlsx ou .csv' },
  { id:'api_erp',    icon:'🔗', nome:'API ERP',        tipo:'REST / JSON',   status:'pendente', detalhe:'Não configurado',           info:'Futura integração com ERP via endpoint REST' },
  { id:'csv_remoto', icon:'🌐', nome:'CSV Remoto',     tipo:'URL / Link',    status:'pendente', detalhe:'Não configurado',           info:'Importar CSV diretamente de uma URL externa' },
];

function loadFontes() {
  try { const s = localStorage.getItem('somotor_fontes'); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveFontes(fontes) {
  try { localStorage.setItem('somotor_fontes', JSON.stringify(fontes)); } catch {}
}

function PanelFontes({ pgStatus, pgLimpo, sheetLimpa, clearing, clearMsg, onClearTabelas }) {
  const [dbInfo,       setDbInfo]       = useState(null);
  const [loadingDb,    setLoadingDb]    = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importing,    setImporting]    = useState(false);
  const [importMsg,    setImportMsg]    = useState('');
  const [importMode,   setImportMode]   = useState('substituir');
  const importRef = useRef(null);
  const API = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

  async function verificarBanco() {
    setLoadingDb(true);
    try {
      const d = await apiFetch('/database/status');
      setDbInfo(d);
    } catch(e) { setDbInfo({ ok:false, error: e.message }); }
    finally { setLoadingDb(false); }
  }

  useEffect(() => { verificarBanco(); }, []);

  // Detecta registros por tabela
  const tabelaInfo = (nome) => {
    if (!dbInfo?.tables) return null;
    return dbInfo.tables.find(t => t.table_name === nome);
  };

  const fontes = [
    {
      id:'filiais_csv', icon:'🏪', nome:'Filiais / Todas as Lojas', tipo:'CSV — estoque_filiais',
      arquivo:'atualizado_sql_todas_as_lojas_csv.csv',
      tabela:'estoque_filiais',
      cor:'#f59e0b',
      instrucao:'Vá em "Lojas / Filiais" e importe o CSV',
      campos:'filial, referencia, descricao, grupo, vlr_vendido_filial_6m…',
    },
    {
      id:'nsd_xlsx', icon:'🏭', nome:'Estoque Matriz (NSD)', tipo:'Excel — estoque_matriz',
      arquivo:'nsd_sql_compra_final.xlsx',
      tabela:'estoque_matriz',
      cor:'#3b82f6',
      instrucao:'Vá em "Planilhas" e importe o .xlsx',
      campos:'referencia, valor_estoque_cd, qtd_ago25…vlr_jan26, margem_pct…',
    },
  ];

  async function handleImportFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    setImporting(true); setImportMsg('');
    try {
      let dadosBrutos = [];
      if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = (await import('xlsx'));
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type:'array', cellDates:true, raw:true });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        dadosBrutos = XLSX.utils.sheet_to_json(ws, { defval:null, raw:true });
      } else if (ext === 'csv') {
        const text = await file.text();
        const sep  = text.slice(0,500).split(';').length >= text.slice(0,500).split(',').length ? ';' : ',';
        const lines = text.split(/\r?\n/).filter(l=>l.trim());
        const headers = lines[0].split(sep).map(h=>h.replace(/^"|"$/g,'').trim()).filter(Boolean);
        dadosBrutos = lines.slice(1).map(line => {
          const vals = line.split(sep).map(v=>v.replace(/^"|"$/g,'').trim());
          const obj  = {};
          headers.forEach((h,i)=>{ obj[h]=vals[i]??null; });
          return obj;
        }).filter(r=>Object.values(r).some(v=>v));
      } else { throw new Error('Use .xlsx, .xls ou .csv'); }

      if (!dadosBrutos.length) throw new Error('Arquivo vazio.');

      const keys = Object.keys(dadosBrutos[0]||{}).map(k=>k.trim().toLowerCase());
      const isFiliais = keys.includes('filial') || keys.includes('saldo_estoque_filial');
      const isMatriz  = keys.includes('saldo_estoque_cd') || keys.includes('qtd_ago25');
      const endpoint  = isFiliais ? '/database/importar-filiais'
                      : isMatriz  ? '/database/importar-matriz'
                      : null;

      if (!endpoint) throw new Error('Arquivo não reconhecido. Verifique se é o CSV de filiais ou o Excel NSD.');

      const LOTE = 1000;
      let total = 0;
      for (let i = 0; i < dadosBrutos.length; i += LOTE) {
        const lote = dadosBrutos.slice(i, i + LOTE);
        const modo = i === 0 ? importMode : 'acumular';
        setImportMsg(`⏳ ${Math.min(i+LOTE, dadosBrutos.length).toLocaleString()} / ${dadosBrutos.length.toLocaleString()} registros…`);
        const d = await apiFetch(endpoint, { method:'POST', body: JSON.stringify({ dados:lote, modo }) });
        total += d.inserted || lote.length;
      }
      setImportMsg(`✅ ${total.toLocaleString()} registros importados com sucesso!`);
      await verificarBanco();
    } catch(e) { setImportMsg(`❌ ${e.message}`); }
    finally { setImporting(false); if (importRef.current) importRef.current.value=''; setTimeout(()=>setImportMsg(''),14000); }
  }

  const tiTb = { fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:1, marginBottom:4 };
  const valTb = { fontFamily:'Bebas Neue', fontSize:22, color:'#f0f0f0', lineHeight:1, marginBottom:2 };

  return (
    <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:20 }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontFamily:'Bebas Neue', fontSize:26, letterSpacing:2, color:'#f0f0f0', margin:0 }}>FONTES DE DADOS</h1>
          <div style={{ fontSize:11, color:'#555', marginTop:2 }}>Status das planilhas importadas no banco</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={verificarBanco} disabled={loadingDb}
            style={{ background:'rgba(46,204,138,.1)', border:'1px solid rgba(46,204,138,.3)', borderRadius:8, padding:'8px 16px', color:'#2ecc8a', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {loadingDb ? '⏳ Verificando…' : '🔍 Verificar Status'}
          </button>
          <button onClick={()=>setConfirmClear(true)} disabled={clearing}
            style={{ background:'rgba(200,16,46,.1)', border:'1px solid rgba(200,16,46,.3)', borderRadius:8, padding:'8px 16px', color:'#C8102E', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {clearing ? '⏳ Limpando…' : '🗑️ Limpar Todos os Dados'}
          </button>
        </div>
      </div>

      {clearMsg && (
        <div style={{ background:clearMsg.startsWith('✓')?'rgba(46,204,138,.1)':'rgba(200,16,46,.1)', border:`1px solid ${clearMsg.startsWith('✓')?'#2ecc8a':'#C8102E'}`, borderRadius:9, padding:'10px 16px', fontSize:13, color:'#ddd' }}>{clearMsg}</div>
      )}

      {/* Cards das fontes */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {fontes.map(f => {
          const info    = tabelaInfo(f.tabela);
          const linhas  = Number(info?.row_estimate||0);
          const temDados = linhas > 0;
          return (
            <div key={f.id} style={{ background:'#161616', border:`1px solid ${temDados?f.cor+'44':'#1e1e1e'}`,
              borderLeft:`4px solid ${temDados?f.cor:'#2a2a2a'}`, borderRadius:12, padding:'20px 22px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:22, marginBottom:6 }}>{f.icon}</div>
                  <div style={{ fontWeight:800, fontSize:15, color:'#f0f0f0' }}>{f.nome}</div>
                  <div style={{ fontSize:10, color:'#555', marginTop:2 }}>{f.tipo}</div>
                </div>
                <div style={{ background:temDados?`${f.cor}18`:'#111', border:`1px solid ${temDados?f.cor+'44':'#2a2a2a'}`,
                  borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:700, color:temDados?f.cor:'#555' }}>
                  {temDados ? '● IMPORTADO' : '○ VAZIO'}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
                <div style={{ background:'#111', borderRadius:8, padding:'10px 12px' }}>
                  <div style={tiTb}>Registros</div>
                  <div style={valTb}>{temDados ? linhas.toLocaleString('pt-BR') : '—'}</div>
                </div>
                <div style={{ background:'#111', borderRadius:8, padding:'10px 12px' }}>
                  <div style={tiTb}>Tabela</div>
                  <div style={{ fontSize:11, fontFamily:'monospace', color:'#888', marginTop:4 }}>{f.tabela}</div>
                </div>
                <div style={{ background:'#111', borderRadius:8, padding:'10px 12px' }}>
                  <div style={tiTb}>Status BD</div>
                  <div style={{ fontSize:11, color:dbInfo?.ok?'#22c55e':'#C8102E', fontWeight:700, marginTop:4 }}>
                    {dbInfo ? (dbInfo.ok?'🟢 Online':'🔴 Erro') : '…'}
                  </div>
                </div>
              </div>

              <div style={{ background:'#111', borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
                <div style={tiTb}>Arquivo esperado</div>
                <div style={{ fontFamily:'monospace', fontSize:11, color:f.cor, marginBottom:4 }}>{f.arquivo}</div>
                <div style={{ fontSize:10, color:'#555' }}>{f.campos}</div>
              </div>

              {!temDados && (
                <div style={{ fontSize:11, color:'#666', background:'rgba(245,158,11,.05)', border:'1px solid rgba(245,158,11,.15)', borderRadius:8, padding:'8px 12px' }}>
                  💡 {f.instrucao}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Importação rápida */}
      <div style={{ background:'rgba(46,204,138,.04)', border:'1px solid rgba(46,204,138,.2)', borderRadius:12, padding:20 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#2ecc8a', marginBottom:12 }}>📥 Importação Rápida</div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <select value={importMode} onChange={e=>setImportMode(e.target.value)}
            style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:8, padding:'8px 14px', color:'#aaa', fontSize:12 }}>
            <option value="substituir">Substituir todos os dados</option>
            <option value="acumular">Acumular (adicionar)</option>
          </select>
          <button onClick={()=>importRef.current?.click()} disabled={importing}
            style={{ background:'#2ecc8a', border:'none', borderRadius:8, padding:'8px 20px', color:'#000', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {importing ? '⏳ Importando…' : '📂 Selecionar arquivo'}
          </button>
          <input ref={importRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:'none' }}
            onChange={e=>handleImportFile(e.target.files?.[0])} />
          <div style={{ fontSize:11, color:'#555' }}>Detecta automaticamente: CSV das Lojas ou Excel NSD</div>
        </div>
        {importMsg && (
          <div style={{ marginTop:10, fontSize:12, color: importMsg.startsWith('✅')?'#2ecc8a':importMsg.startsWith('❌')?'#C8102E':'#f59e0b' }}>{importMsg}</div>
        )}
      </div>

      {/* Info banco */}
      {dbInfo?.ok && (
        <div style={{ background:'#161616', border:'1px solid #1e1e1e', borderRadius:12, padding:16 }}>
          <div style={{ fontWeight:700, fontSize:12, color:'#555', marginBottom:10, textTransform:'uppercase', letterSpacing:1 }}>🐘 PostgreSQL — {dbInfo.database} @ {dbInfo.host}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:8 }}>
            {(dbInfo.tables||[]).filter(t=>['estoque_filiais','estoque_matriz','filiais','clientes'].includes(t.table_name)).map(t => (
              <div key={t.table_name} style={{ background:'#111', borderRadius:8, padding:'10px 12px' }}>
                <div style={{ fontSize:9, color:'#555', textTransform:'uppercase', letterSpacing:.8, marginBottom:3 }}>{t.table_name}</div>
                <div style={{ fontSize:15, fontWeight:800, color: Number(t.row_estimate)>0?'#f0f0f0':'#333', fontFamily:'monospace' }}>
                  {Number(t.row_estimate).toLocaleString('pt-BR')}
                </div>
                <div style={{ fontSize:9, color:'#555' }}>registros</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:10, color:'#555', marginTop:10 }}>Latência: {dbInfo.latency_ms}ms · PG {dbInfo.version}</div>
        </div>
      )}

      {/* Confirm clear */}
      {confirmClear && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:14, padding:'32px 36px', textAlign:'center', maxWidth:380 }}>
            <div style={{ fontSize:36, marginBottom:14 }}>⚠️</div>
            <div style={{ fontFamily:'Bebas Neue', fontSize:22, color:'#f0f0f0', letterSpacing:2, marginBottom:8 }}>LIMPAR TODOS OS DADOS?</div>
            <div style={{ fontSize:12, color:'#666', marginBottom:24 }}>Isso irá apagar todos os registros de produtos, estoque_filiais e estoque_matriz. Os usuários e a estrutura do banco serão mantidos.</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={()=>setConfirmClear(false)} style={{ background:'#1f1f1f', border:'1px solid #2a2a2a', borderRadius:8, padding:'10px 22px', color:'#888', fontSize:12, cursor:'pointer' }}>Cancelar</button>
              <button onClick={()=>{ setConfirmClear(false); onClearTabelas && onClearTabelas(); }}
                style={{ background:'#C8102E', border:'none', borderRadius:8, padding:'10px 22px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>Confirmar limpeza</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════
   PAINEL SQL
═══════════════════════════════════════════════════════════ */
function PanelSQL({ pgStatus, setPgStatus }) {
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [sql,        setSql]        = useState('');
  const [result,     setResult]     = useState(null);
  const [qLoading,   setQLoading]   = useState(false);
  const [activeTable,setActiveTable]= useState('');
  const logRef = useRef(null);

  function addLog(msg, type = '') {
    if (!logRef.current) return;
    const d = document.createElement('div');
    d.style.cssText = `padding:2px 0;color:${
      type==='ok' ? '#2ecc8a' : type==='err' ? '#e8452a' : type==='info' ? '#f5a623' : '#6b7490'
    }`;
    d.textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`;
    logRef.current.appendChild(d);
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }

  async function fetchStatus() {
    setLoading(true);
    setError('');
    addLog('Conectando ao banco...', 'info');
    try {
      const data = await apiFetch('/database/status');
      setPgStatus(data);
      addLog(`✓ Conectado: PostgreSQL ${data.version}`, 'ok');
      addLog(`✓ Latência: ${data.latency_ms}ms`, 'ok');
      addLog(`✓ ${data.tables.length} tabela(s) encontrada(s)`, 'ok');
    } catch (e) {
      setError(e.message);
      setPgStatus(null);
      addLog(`✗ ${e.message}`, 'err');
    } finally {
      setLoading(false);
    }
  }

  async function loadTable(name) {
    setActiveTable(name);
    const q = `SELECT * FROM "${name}" LIMIT 100;`;
    setSql(q);
    runQuery(q);
  }

  async function runQuery(overrideSql) {
    const query = overrideSql || sql;
    if (!query.trim()) return;
    setQLoading(true);
    setResult(null);
    setError('');
    addLog('Executando query...', 'info');
    try {
      const data = await apiFetch('/database/query', {
        method: 'POST',
        body: JSON.stringify({ sql: query }),
      });
      setResult(data);
      addLog(`✓ ${data.row_count} linha(s) · ${data.latency_ms}ms`, 'ok');
    } catch (e) {
      setError(e.message);
      addLog(`✗ ${e.message}`, 'err');
    } finally {
      setQLoading(false);
    }
  }

  function exportCSV() {
    if (!result?.rows?.length) return;
    const cols = result.columns;
    let csv = cols.join(',') + '\n';
    result.rows.forEach(row =>
      csv += cols.map(c => `"${String(row[c]??'').replace(/"/g,'""')}"`).join(',') + '\n'
    );
    downloadText(csv, 'somotor_query.csv');
  }

  return (
    <div>
      <h1 style={S.title}>BANCO DE DADOS</h1>
      <p style={S.sub}>Conexão direta com PostgreSQL</p>

      <div style={{ ...S.statusBar, borderColor: pgStatus ? '#2ecc8a' : '#2a2a2a' }}>
        <span style={{ ...S.dot, background: pgStatus ? '#2ecc8a' : '#555',
          boxShadow: pgStatus ? '0 0 8px #2ecc8a' : 'none' }} />
        <span style={{ fontFamily:'monospace', fontSize:13, color: pgStatus ? '#e2e6f0' : '#666' }}>
          {pgStatus
            ? `✓ Conectado · PostgreSQL ${pgStatus.version} · ${pgStatus.database}@${pgStatus.host} · ${pgStatus.latency_ms}ms`
            : 'Aguardando conexão...'}
        </span>
        <button style={{ ...S.btn, ...S.btnPrimary, marginLeft:'auto' }}
                onClick={fetchStatus} disabled={loading}>
          {loading ? '⏳ Conectando...' : '🔌 Verificar Status'}
        </button>
      </div>

      {error && <div style={S.errorBox}>⚠ {error}</div>}

      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardLabel}>TABELAS DO BANCO</div>
          {pgStatus
            ? pgStatus.tables.length > 0
              ? pgStatus.tables.map(t => (
                  <button key={t.table_name}
                          style={{ ...S.tableBtn,
                            background: activeTable===t.table_name ? 'rgba(200,16,46,.15)' : 'transparent',
                            borderColor: activeTable===t.table_name ? '#C8102E' : '#2a2a2a' }}
                          onClick={() => loadTable(t.table_name)}>
                    <span style={{ color:'#C8102E' }}>◉</span>&nbsp;{t.table_name}
                    <span style={{ marginLeft:'auto', color:'#555', fontSize:11 }}>
                      ~{Number(t.row_estimate).toLocaleString()} linhas
                    </span>
                  </button>
                ))
              : <p style={{ color:'#666', fontSize:13 }}>Nenhuma tabela encontrada.</p>
            : <p style={{ color:'#666', fontSize:13 }}>Conecte para listar as tabelas...</p>}
        </div>

        <div style={S.card}>
          <div style={S.cardLabel}>INFORMAÇÕES DO SERVIDOR</div>
          {pgStatus ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                ['Banco',    pgStatus.database],
                ['Host',     pgStatus.host],
                ['Versão',   `PG ${pgStatus.version}`],
                ['Latência', `${pgStatus.latency_ms}ms`],
                ['Tabelas',  pgStatus.tables.length],
              ].map(([k,v]) => (
                <div key={k} style={S.statChip}>
                  <div style={S.cardLabel}>{k}</div>
                  <div style={{ fontFamily:'monospace', color:'#C8102E', fontWeight:600 }}>{v}</div>
                </div>
              ))}
            </div>
          ) : <p style={{ color:'#666', fontSize:13 }}>—</p>}
        </div>
      </div>

      <div style={{ ...S.card, marginTop:16 }}>
        <div style={S.cardLabel}>EDITOR DE QUERY</div>
        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          style={S.queryEditor}
          spellCheck={false}
          placeholder="Digite sua query SQL aqui... ex: SELECT * FROM produtos LIMIT 50;"
        />
        <div style={{ display:'flex', gap:10, marginTop:12, alignItems:'center' }}>
          <button style={{ ...S.btn, ...S.btnPrimary }}
                  onClick={() => runQuery()} disabled={qLoading || !sql.trim()}>
            {qLoading ? '⏳ Executando...' : '▶  Executar'}
          </button>
          <button style={{ ...S.btn, ...S.btnOutline }}
                  onClick={() => { setSql(''); setResult(null); setError(''); }}>
            🗑 Limpar
          </button>
          {result && (
            <button style={{ ...S.btn, ...S.btnOutline }} onClick={exportCSV}>⬇ Exportar CSV</button>
          )}
          {result && (
            <span style={{ marginLeft:'auto', fontFamily:'monospace', fontSize:12, color:'#666' }}>
              {result.row_count} linhas · {result.latency_ms}ms
            </span>
          )}
        </div>
      </div>

      {result?.rows?.length > 0 && (
        <div style={{ ...S.tableWrap, marginTop:16 }}>
          <div style={S.tableTbar}>
            <span style={{ fontFamily:'monospace', fontSize:13, color:'#f5a623' }}>
              {result.row_count} registros
            </span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>{result.columns.map(c => <th key={c} style={S.th}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {result.rows.slice(0,200).map((row, i) => (
                  <tr key={i}>
                    {result.columns.map(c => (
                      <td key={c} style={S.td}>{String(row[c] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div ref={logRef} style={S.logBox} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAINEL PLANILHAS
═══════════════════════════════════════════════════════════ */
function PanelSheets({ sheets, setSheets, activeSheet, setActiveSheet, fileName, setFileName, onClearSheet }) {
  const [filter,          setFilter]          = useState('');
  const [filterCol,       setFilterCol]       = useState('');
  const [dragOver,        setDragOver]        = useState(false);
  const [dateCol,         setDateCol]         = useState('');
  const [startMonth,      setStartMonth]      = useState('');
  const [endMonth,        setEndMonth]        = useState('');
  const [quantityCol,     setQuantityCol]     = useState('');
  const [locationStateCol,setLocationStateCol]= useState('');
  const [locationCityCol, setLocationCityCol] = useState('');

  const currentSheet = sheets[activeSheet];
  const detectedDateCols = currentSheet ? detectDateColumns(currentSheet) : [];
  const detectedQtyCols  = currentSheet ? detectQuantityColumns(currentSheet) : [];
  const detectedLocation = currentSheet ? detectLocationColumns(currentSheet) : { stateCols: [], cityCols: [] };
  const monthOptions     = currentSheet ? getAvailableMonths(currentSheet, dateCol) : [];

  const textFilteredRows = !currentSheet
    ? []
    : currentSheet.rows.filter(row => {
        const q = filter.trim().toLowerCase();
        if (!q) return true;
        if (filterCol !== '') return String(row[+filterCol] ?? '').toLowerCase().includes(q);
        return row.some(c => String(c ?? '').toLowerCase().includes(q));
      });

  const filteredRows = textFilteredRows.filter(row => {
    if (!dateCol || (!startMonth && !endMonth)) return true;
    const dt = parseDateValue(row[+dateCol]);
    if (!dt) return false;
    const mk = dt.getFullYear() * 100 + (dt.getMonth() + 1);
    const start = startMonth ? Number(startMonth) : -Infinity;
    const end   = endMonth   ? Number(endMonth)   : Infinity;
    return mk >= start && mk <= end;
  });

  const quantityTotal = currentSheet && quantityCol !== ''
    ? filteredRows.reduce((acc, row) => acc + parseNumericValue(row[+quantityCol]), 0)
    : null;

  const mapSummary = currentSheet
    ? buildBuyerLocationSummary(filteredRows, locationStateCol, locationCityCol)
    : { total: 0, states: [], cities: [] };

  function parseFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(ext)) return;
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type:'array', cellDates:true });
      const parsed = wb.SheetNames.map(sn => {
        const all = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header:1, defval:'' });
        const [header, ...rows] = all;
        return { name: sn, header: header || [], rows: rows || [] };
      }).filter(s => s.rows.length > 0);
      setSheets(parsed);
      setActiveSheet(0);
      setFileName(file.name);
      setFilter('');
      setFilterCol('');
      const firstSheet = parsed[0];
      const firstDateCols = firstSheet ? detectDateColumns(firstSheet) : [];
      const firstQtyCols  = firstSheet ? detectQuantityColumns(firstSheet) : [];
      setDateCol(firstDateCols[0]?.index != null ? String(firstDateCols[0].index) : '');
      setQuantityCol(firstQtyCols[0]?.index != null ? String(firstQtyCols[0].index) : '');
      const firstLocations = firstSheet ? detectLocationColumns(firstSheet) : { stateCols: [], cityCols: [] };
      setLocationStateCol(firstLocations.stateCols[0]?.index != null ? String(firstLocations.stateCols[0].index) : '');
      setLocationCityCol(firstLocations.cityCols[0]?.index != null ? String(firstLocations.cityCols[0].index) : '');
      setStartMonth('');
      setEndMonth('');
    };
    reader.readAsArrayBuffer(file);
  }

  function exportCSV() {
    if (!currentSheet) return;
    let csv = currentSheet.header.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',') + '\n';
    filteredRows.forEach(row => {
      csv += currentSheet.header.map((_,i) =>
        `"${String(row[i] ?? '').replace(/"/g,'""')}"`
      ).join(',') + '\n';
    });
    const baseName = (fileName || currentSheet.name || 'dados').replace(/\.[^.]+$/, '');
    downloadText(csv, `${baseName}_${currentSheet.name}_filtrado.csv`);
  }

  if (!sheets.length) {
    return (
      <div>
        <h1 style={S.title}>ANÁLISE DE PLANILHAS</h1>
        <p style={S.sub}>Importe arquivos Excel ou CSV — análise 100% local, sem vínculo com o banco SQL</p>
        <div
          style={{ ...S.uploadZone,
            borderColor: dragOver ? '#C8102E' : '#2a2a2a',
            background:  dragOver ? 'rgba(200,16,46,.04)' : '#0d0d0d' }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); parseFile(e.dataTransfer.files[0]); }}
          onClick={() => document.getElementById('fileInput').click()}
        >
          <input id="fileInput" type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
                 onChange={e => parseFile(e.target.files[0])} />
          <div style={{ fontSize:52, marginBottom:14, opacity:.35 }}>📊</div>
          <div style={{ fontSize:20, fontWeight:700, letterSpacing:2, marginBottom:8 }}>ARRASTE SEU ARQUIVO AQUI</div>
          <div style={{ color:'#666', fontSize:13 }}>Suporte a .xlsx, .xls e .csv</div>
          <div style={{ color:'#555', fontSize:12, marginTop:8 }}>ou clique para selecionar</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={S.title}>ANÁLISE DE PLANILHAS</h1>
      <p style={S.sub}>Análise 100% local — agora com filtro por período mensal e exportação do CSV filtrado</p>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, gap:16, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontFamily:'monospace', fontSize:14, color:'#f5a623', marginBottom:8 }}>📄 {fileName}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[
              ['Linhas filtradas', filteredRows.length],
              ['Colunas', currentSheet?.header.length ?? 0],
              ['Abas', sheets.length],
              ['Quantidade', quantityTotal != null ? formatCompactNumber(quantityTotal) : '—'],
            ].map(([k,v]) => (
              <div key={k} style={S.statChip}>
                {k}: <strong style={{ fontFamily:'monospace', color:'#e2e6f0' }}>{v}</strong>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button style={{ ...S.btn, ...S.btnOutline }}
                  onClick={() => {
                    if (onClearSheet) {
                      onClearSheet();
                    } else {
                      setSheets([]); setFileName('');
                    }
                    setDateCol(''); setQuantityCol('');
                    setLocationStateCol(''); setLocationCityCol('');
                    setStartMonth(''); setEndMonth('');
                  }}>🗑 Remover</button>
          <button style={{ ...S.btn, ...S.btnOutline }} onClick={exportCSV}>⬇ Exportar CSV filtrado</button>
        </div>
      </div>

      {sheets.length > 1 && (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {sheets.map((s,i) => (
            <button key={s.name}
                    style={{ ...S.btn, ...(i===activeSheet ? S.btnPrimary : S.btnOutline), padding:'6px 14px', fontSize:12 }}
                    onClick={() => {
                      setActiveSheet(i);
                      setFilter('');
                      setFilterCol('');
                      const nextDateCols = detectDateColumns(s);
                      const nextQtyCols  = detectQuantityColumns(s);
                      const nextLocations = detectLocationColumns(s);
                      setDateCol(nextDateCols[0]?.index != null ? String(nextDateCols[0].index) : '');
                      setQuantityCol(nextQtyCols[0]?.index != null ? String(nextQtyCols[0].index) : '');
                      setLocationStateCol(nextLocations.stateCols[0]?.index != null ? String(nextLocations.stateCols[0].index) : '');
                      setLocationCityCol(nextLocations.cityCols[0]?.index != null ? String(nextLocations.cityCols[0].index) : '');
                      setStartMonth('');
                      setEndMonth('');
                    }}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ ...S.card, marginBottom:16 }}>
        <div style={{ ...S.cardLabel, marginBottom:14 }}>Filtros e período</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, marginBottom:14 }}>
          <div>
            <div style={S.fieldLabel}>Busca livre</div>
            <input style={S.input}
                   placeholder="🔍 Filtrar dados..."
                   value={filter}
                   onChange={e => setFilter(e.target.value)} />
          </div>

          <div>
            <div style={S.fieldLabel}>Coluna da busca</div>
            <select style={S.input}
                    value={filterCol} onChange={e => setFilterCol(e.target.value)}>
              <option value="">Todas as colunas</option>
              {currentSheet?.header.map((h,i) => (
                <option key={i} value={i}>{h || `Col ${i+1}`}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={S.fieldLabel}>Coluna da data</div>
            <select style={S.input}
                    value={dateCol}
                    onChange={e => { setDateCol(e.target.value); setStartMonth(''); setEndMonth(''); }}>
              <option value="">Sem filtro por período</option>
              {detectedDateCols.map(col => (
                <option key={col.index} value={col.index}>{col.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={S.fieldLabel}>Coluna de quantidade</div>
            <select style={S.input}
                    value={quantityCol}
                    onChange={e => setQuantityCol(e.target.value)}>
              <option value="">Coluna de quantidade</option>
              {detectedQtyCols.map(col => (
                <option key={col.index} value={col.index}>{col.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={S.periodPanel}>
          <div style={S.periodHeader}>Seleção de período</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
            <div>
              <div style={S.fieldLabel}>Mês/ano inicial</div>
              <select style={S.input} value={startMonth} onChange={e => setStartMonth(e.target.value)} disabled={!dateCol}>
                <option value="">Mês/ano inicial</option>
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={S.fieldLabel}>Mês/ano final</div>
              <select style={S.input} value={endMonth} onChange={e => setEndMonth(e.target.value)} disabled={!dateCol}>
                <option value="">Mês/ano final</option>
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={S.fieldLabel}>Coluna UF / Estado</div>
              <select style={S.input} value={locationStateCol} onChange={e => setLocationStateCol(e.target.value)}>
                <option value="">Sem mapa por UF</option>
                {detectedLocation.stateCols.map(col => (
                  <option key={col.index} value={col.index}>{col.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={S.fieldLabel}>Coluna Cidade</div>
              <select style={S.input} value={locationCityCol} onChange={e => setLocationCityCol(e.target.value)}>
                <option value="">Cidade opcional</option>
                {detectedLocation.cityCols.map(col => (
                  <option key={col.index} value={col.index}>{col.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={S.filterBadges}>
            <span style={S.filterBadge}>Período ativo: {formatPeriodLabel(startMonth, endMonth)}</span>
            <span style={S.filterBadge}>Linhas filtradas: {filteredRows.length.toLocaleString('pt-BR')}</span>
            {quantityTotal != null && <span style={S.filterBadge}>Quantidade total: {formatCompactNumber(quantityTotal)}</span>}
          </div>
        </div>
      </div>

      <div style={{ ...S.tableWrap, maxHeight:420, overflowY:'auto' }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, position:'sticky', top:0, left:0, zIndex:3, background:'#161616' }}>#</th>
              {currentSheet?.header.map((h,i) => (
                <th key={i} style={{ ...S.th, position:'sticky', top:0, zIndex:2, background:'#161616' }}>
                  {h || `Col ${i+1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.slice(0,500).map((row, ri) => (
              <tr key={ri}>
                <td style={{ ...S.td, color:'#555', fontWeight:600 }}>{ri+1}</td>
                {currentSheet.header.map((_,ci) => (
                  <td key={ci} style={S.td}>{String(row[ci] ?? '')}</td>
                ))}
              </tr>
            ))}
            {filteredRows.length > 500 && (
              <tr><td colSpan={currentSheet.header.length+1}
                      style={{ textAlign:'center', color:'#555', padding:14, fontSize:12 }}>
                ... e mais {filteredRows.length - 500} linhas
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop:28 }}>
        <h2 style={{ ...S.title, fontSize:20 }}>MAPA DE COMPRADORES</h2>
        <p style={{ ...S.sub, marginBottom:12 }}>Use a coluna de UF/Estado para visualizar onde estão concentrados os compradores filtrados.</p>
        <div style={{ display:'grid', gridTemplateColumns:'minmax(320px, 1.3fr) minmax(260px, .7fr)', gap:16, alignItems:'stretch' }}>
          <BrazilBuyersMap summary={mapSummary} />
          <div style={S.card}>
            <div style={S.cardLabel}>Concentração por localização</div>
            {mapSummary.states.length ? (
              <div style={{ display:'grid', gap:8 }}>
                {mapSummary.states.slice(0, 8).map((item, idx) => (
                  <div key={item.code} style={S.rankRow}>
                    <span style={S.rankIndex}>{idx + 1}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ color:'#fff', fontWeight:600 }}>{item.code}</div>
                      <div style={{ color:'#666', fontSize:12 }}>{item.name}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ color:'#f5a623', fontFamily:'monospace', fontWeight:700 }}>{item.count.toLocaleString('pt-BR')}</div>
                      <div style={{ color:'#666', fontSize:12 }}>{item.percent}% dos compradores</div>
                    </div>
                  </div>
                ))}
                {mapSummary.cities.length > 0 && (
                  <div style={{ ...S.periodPanel, marginTop:8 }}>
                    <div style={S.fieldLabel}>Cidades mais recorrentes</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {mapSummary.cities.slice(0, 8).map(city => (
                        <span key={city.name} style={S.cityChip}>{city.name} · {city.count}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color:'#666', fontSize:13, lineHeight:1.7 }}>
                Selecione uma coluna de UF/Estado para desenhar o mapa de compradores.
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop:28 }}>
        <h2 style={{ ...S.title, fontSize:20 }}>RESUMO ESTATÍSTICO</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:12, marginTop:12 }}>
          {currentSheet?.header.slice(0,12).map((col, ci) => {
            const vals = filteredRows.map(r => r[ci]).filter(v => v !== '' && v !== null && v !== undefined);
            const nums = vals.map(parseNumericValue).filter(n => !isNaN(n) && isFinite(n));
            const isNum = nums.length > vals.length * 0.6 && nums.length > 0;
            return (
              <div key={ci} style={S.card}>
                <div style={S.cardLabel}>{col || `Col ${ci+1}`}</div>
                <div style={{ fontFamily:'monospace', fontSize:12, color:'#666', lineHeight:1.9 }}>
                  Preenchidos: <strong style={{color:'#e2e6f0'}}>{vals.length}</strong><br/>
                  Nulos: <strong style={{color:'#e2e6f0'}}>{filteredRows.length - vals.length}</strong><br/>
                  {isNum ? <>
                    Mín: <strong style={{color:'#e2e6f0'}}>{formatCompactNumber(Math.min(...nums))}</strong><br/>
                    Máx: <strong style={{color:'#e2e6f0'}}>{formatCompactNumber(Math.max(...nums))}</strong><br/>
                    Quantidade média: <strong style={{color:'#f5a623'}}>{formatCompactNumber(nums.reduce((a,b)=>a+b,0)/nums.length)}</strong>
                  </> : <>
                    Únicos: <strong style={{color:'#e2e6f0'}}>{new Set(vals).size}</strong>
                  </>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseNumericValue(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const clean = raw
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const n = Number(clean);
  return isFinite(n) ? n : 0;
}

function parseDateValue(value) {
  if (value instanceof Date && !isNaN(value)) return value;
  if (typeof value === 'number' && value > 20000 && value < 80000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d || 1);
  }

  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3] || 1));

  const br = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (br) {
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    return new Date(year, Number(br[2]) - 1, Number(br[1]));
  }

  const monthYear = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthYear) return new Date(Number(monthYear[2]), Number(monthYear[1]) - 1, 1);

  const native = new Date(raw);
  return isNaN(native) ? null : native;
}

function detectDateColumns(sheet) {
  if (!sheet) return [];
  return sheet.header
    .map((header, index) => {
      const label = header || `Col ${index + 1}`;
      const normalized = normalizeText(label);
      const sample = sheet.rows.slice(0, 80).map(row => row[index]).filter(v => v !== '' && v != null);
      const parsed = sample.filter(v => parseDateValue(v));
      const headerLooksLikeDate = /(data|date|periodo|period|mes|mês|competencia|competência|ano)/.test(normalized);
      const sampleLooksLikeDate = sample.length > 0 && parsed.length >= Math.max(3, sample.length * 0.4);
      return headerLooksLikeDate || sampleLooksLikeDate ? { index, label } : null;
    })
    .filter(Boolean);
}

function detectQuantityColumns(sheet) {
  if (!sheet) return [];
  return sheet.header
    .map((header, index) => {
      const label = header || `Col ${index + 1}`;
      const normalized = normalizeText(label);
      const sample = sheet.rows.slice(0, 80).map(row => row[index]).filter(v => v !== '' && v != null);
      const nums = sample.map(parseNumericValue).filter(v => !isNaN(v) && isFinite(v));
      const headerLooksLikeQty = /(qtd|qtde|quantidade|pecas|peças|volume|itens|itens vendidos|unidades)/.test(normalized);
      const sampleLooksNumeric = sample.length > 0 && nums.length >= Math.max(3, sample.length * 0.6);
      return headerLooksLikeQty || sampleLooksNumeric ? { index, label } : null;
    })
    .filter(Boolean);
}


const BRAZIL_STATE_POINTS = {
  AC:{x:86,y:250,name:'Acre'}, AL:{x:469,y:255,name:'Alagoas'}, AP:{x:408,y:78,name:'Amapá'}, AM:{x:193,y:126,name:'Amazonas'},
  BA:{x:446,y:227,name:'Bahia'}, CE:{x:485,y:167,name:'Ceará'}, DF:{x:380,y:248,name:'Distrito Federal'}, ES:{x:459,y:302,name:'Espírito Santo'},
  GO:{x:352,y:258,name:'Goiás'}, MA:{x:444,y:141,name:'Maranhão'}, MT:{x:282,y:234,name:'Mato Grosso'}, MS:{x:314,y:304,name:'Mato Grosso do Sul'},
  MG:{x:417,y:286,name:'Minas Gerais'}, PA:{x:343,y:117,name:'Pará'}, PB:{x:511,y:189,name:'Paraíba'}, PR:{x:380,y:390,name:'Paraná'},
  PE:{x:492,y:209,name:'Pernambuco'}, PI:{x:444,y:171,name:'Piauí'}, RJ:{x:448,y:325,name:'Rio de Janeiro'}, RN:{x:518,y:173,name:'Rio Grande do Norte'},
  RS:{x:343,y:474,name:'Rio Grande do Sul'}, RO:{x:143,y:219,name:'Rondônia'}, RR:{x:229,y:40,name:'Roraima'}, SC:{x:367,y:424,name:'Santa Catarina'},
  SP:{x:390,y:340,name:'São Paulo'}, SE:{x:484,y:239,name:'Sergipe'}, TO:{x:382,y:193,name:'Tocantins'}
};

const BRAZIL_STATE_NAME_TO_CODE = {
  acre:'AC', alagoas:'AL', amapa:'AP', amapá:'AP', amazonas:'AM', bahia:'BA', ceara:'CE', ceará:'CE',
  'distrito federal':'DF', 'espirito santo':'ES', 'espírito santo':'ES', goias:'GO', goiás:'GO', maranhao:'MA', maranhão:'MA',
  'mato grosso':'MT', 'mato grosso do sul':'MS', 'minas gerais':'MG', para:'PA', pará:'PA', paraiba:'PB', paraíba:'PB',
  parana:'PR', paraná:'PR', pernambuco:'PE', piaui:'PI', piauí:'PI', 'rio de janeiro':'RJ', 'rio grande do norte':'RN',
  'rio grande do sul':'RS', rondonia:'RO', rondônia:'RO', roraima:'RR', 'santa catarina':'SC', 'sao paulo':'SP', 'são paulo':'SP',
  sergipe:'SE', tocantins:'TO'
};

function detectLocationColumns(sheet) {
  if (!sheet) return { stateCols: [], cityCols: [] };
  const stateCols = [];
  const cityCols = [];
  sheet.header.forEach((header, index) => {
    const label = header || `Col ${index + 1}`;
    const normalized = normalizeText(label);
    const sample = sheet.rows.slice(0, 120).map(row => row[index]).filter(v => v !== '' && v != null);
    const ufMatches = sample.filter(v => normalizeBrazilState(v)).length;
    const looksState = /(uf|estado|state|regiao|região)/.test(normalized) || (sample.length > 0 && ufMatches >= Math.max(3, sample.length * 0.35));
    const looksCity = /(cidade|municipio|município|city|localidade)/.test(normalized);
    if (looksState) stateCols.push({ index, label });
    if (looksCity) cityCols.push({ index, label });
  });
  return { stateCols, cityCols };
}

function normalizeBrazilState(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (BRAZIL_STATE_POINTS[upper]) return upper;
  return BRAZIL_STATE_NAME_TO_CODE[normalizeText(raw)] || '';
}

function buildBuyerLocationSummary(rows, stateCol, cityCol) {
  if (stateCol === '') return { total: 0, states: [], cities: [] };
  const stateMap = new Map();
  const cityMap = new Map();
  rows.forEach(row => {
    const code = normalizeBrazilState(row[+stateCol]);
    if (!code) return;
    stateMap.set(code, (stateMap.get(code) || 0) + 1);
    if (cityCol !== '') {
      const city = String(row[+cityCol] ?? '').trim();
      if (city) cityMap.set(city, (cityMap.get(city) || 0) + 1);
    }
  });
  const total = [...stateMap.values()].reduce((a,b) => a+b, 0);
  const states = [...stateMap.entries()]
    .map(([code, count]) => ({
      code,
      count,
      name: BRAZIL_STATE_POINTS[code]?.name || code,
      percent: total ? ((count / total) * 100).toFixed(1).replace('.', ',') : '0,0',
      ...BRAZIL_STATE_POINTS[code],
    }))
    .sort((a,b) => b.count - a.count);
  const cities = [...cityMap.entries()].map(([name,count]) => ({ name, count })).sort((a,b)=> b.count-a.count);
  return { total, states, cities };
}

function formatPeriodLabel(startMonth, endMonth) {
  if (!startMonth && !endMonth) return 'Todos os períodos';
  const makeLabel = value => {
    const year = String(value).slice(0, 4);
    const month = String(value).slice(4).padStart(2, '0');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('pt-BR', { month:'short', year:'numeric' });
  };
  const start = startMonth ? makeLabel(startMonth) : 'início livre';
  const end = endMonth ? makeLabel(endMonth) : 'fim livre';
  return `${start} até ${end}`;
}

function BrazilBuyersMap({ summary }) {
  const maxCount = Math.max(...summary.states.map(item => item.count), 1);
  return (
    <div style={{ ...S.card, minHeight: 480, position:'relative', overflow:'hidden' }}>
      <div style={S.cardLabel}>Mapa por UF</div>
      <div style={{ color:'#666', fontSize:13, marginBottom:10 }}>
        {summary.total
          ? `${summary.total.toLocaleString('pt-BR')} compradores com localização identificada no filtro atual.`
          : 'Nenhuma localização encontrada no filtro atual.'}
      </div>
      <svg viewBox="0 0 600 520" style={{ width:'100%', height:'100%', minHeight:400, background:'radial-gradient(circle at top, rgba(200,16,46,.08), transparent 45%), #0d0d0d', borderRadius:12 }}>
        <path d="M157 98l61-44 85 3 53 34 73 10 57 58 16 60-31 85-64 36-3 57-45 53-57 13-68-37-51-88-78-24-71-75 8-76 54-65z"
              fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.08)" strokeWidth="2" />
        {summary.states.map(item => {
          const r = 8 + (item.count / maxCount) * 26;
          return (
            <g key={item.code}>
              <circle cx={item.x} cy={item.y} r={r} fill="rgba(200,16,46,.25)" stroke="rgba(200,16,46,.85)" strokeWidth="2" />
              <circle cx={item.x} cy={item.y} r="3.5" fill="#fff" />
              <text x={item.x} y={item.y - r - 8} textAnchor="middle" fill="#f2f2f2" fontSize="12" fontFamily="monospace">{item.code}</text>
              <text x={item.x} y={item.y + r + 16} textAnchor="middle" fill="#f5a623" fontSize="11" fontFamily="monospace">{item.count}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function getAvailableMonths(sheet, dateCol) {
  if (!sheet || dateCol === '') return [];
  const seen = new Map();
  sheet.rows.forEach(row => {
    const dt = parseDateValue(row[+dateCol]);
    if (!dt) return;
    const value = String(dt.getFullYear() * 100 + (dt.getMonth() + 1));
    if (!seen.has(value)) {
      seen.set(value, dt.toLocaleDateString('pt-BR', { month:'long', year:'numeric' }));
    }
  });
  return [...seen.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([value, label]) => ({ value, label: label[0].toUpperCase() + label.slice(1) }));
}

function formatCompactNumber(value) {
  const num = Number(value ?? 0);
  if (!isFinite(num)) return '0';
  return num.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding:'13px 22px', cursor:'pointer', border:'none', background:'transparent',
      fontWeight:600, fontSize:13, letterSpacing:.3, transition:'all .2s',
      color: active ? '#C8102E' : '#666',
      borderBottom: active ? '2px solid #C8102E' : '2px solid transparent',
    }}>
      {children}
    </button>
  );
}

function Pill({ color, children }) {
  return (
    <span style={{ background:color, color:'#fff', fontSize:10, fontWeight:700,
      padding:'1px 7px', borderRadius:10, marginLeft:4 }}>
      {children}
    </span>
  );
}

function downloadText(text, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF'+text], { type:'text/csv;charset=utf-8;' }));
  a.download = filename;
  a.click();
}

/* ═══════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════ */
const S = {
  page:       { background:'#0d0d0d', color:'#e2e6f0', minHeight:'100vh', fontFamily:"'DM Sans',sans-serif" },
  tabBar:     { background:'#161616', borderBottom:'1px solid #1a1a1a', padding:'0 24px', display:'flex', gap:0 },
  content:    { padding:'32px', maxWidth:1400, margin:'0 auto' },
  title:      { fontWeight:800, fontSize:26, letterSpacing:.5, marginBottom:6, lineHeight:1, color:'#fff' },
  sub:        { color:'#666', fontSize:13, marginBottom:24 },
  card:       { background:'#161616', border:'1px solid #1e1e1e', borderRadius:10, padding:18 },
  cardLabel:  { fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:'uppercase', color:'#555', marginBottom:6 },
  grid2:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:16 },
  statusBar:  { display:'flex', alignItems:'center', gap:12, padding:'11px 16px',
                borderRadius:9, border:'1px solid', background:'#161616', marginBottom:16 },
  dot:        { width:9, height:9, borderRadius:'50%', flexShrink:0 },
  errorBox:   { background:'rgba(200,16,46,.1)', border:'1px solid #C8102E', borderRadius:8,
                padding:'10px 16px', color:'#C8102E', fontSize:13, marginBottom:14 },
  btn:        { display:'inline-flex', alignItems:'center', gap:6, padding:'9px 18px',
                borderRadius:7, border:'none', fontWeight:600, fontSize:13, cursor:'pointer', transition:'all .2s' },
  btnPrimary: { background:'#C8102E', color:'#fff' },
  btnOutline: { background:'transparent', border:'1px solid #2a2a2a', color:'#aaa' },
  input:      { width:'100%', background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:7,
                padding:'9px 13px', color:'#e2e6f0', fontFamily:'monospace', fontSize:13, outline:'none' },
  queryEditor:{ width:'100%', background:'#0d0d0d', border:'1px solid #2a2a2a', borderRadius:9,
                padding:14, color:'#a8d8a8', fontFamily:'monospace', fontSize:13,
                height:110, resize:'vertical', outline:'none', lineHeight:1.6 },
  tableWrap:  { border:'1px solid #1e1e1e', borderRadius:10, overflow:'hidden' },
  tableTbar:  { display:'flex', alignItems:'center', padding:'11px 16px',
                background:'#161616', borderBottom:'1px solid #1e1e1e' },
  table:      { width:'100%', borderCollapse:'collapse' },
  th:         { padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600,
                letterSpacing:1, textTransform:'uppercase', color:'#555',
                borderBottom:'1px solid #1e1e1e', whiteSpace:'nowrap' },
  td:         { padding:'9px 14px', fontSize:12, borderBottom:'1px solid #1a1a1a',
                fontFamily:'monospace', whiteSpace:'nowrap' },
  logBox:     { background:'#0d0d0d', border:'1px solid #1e1e1e', borderRadius:9,
                padding:12, fontFamily:'monospace', fontSize:12, color:'#555',
                height:110, overflowY:'auto', marginTop:14 },
  tableBtn:   { display:'flex', alignItems:'center', width:'100%', padding:'8px 12px',
                marginBottom:5, borderRadius:7, border:'1px solid', cursor:'pointer',
                fontFamily:'monospace', fontSize:12, color:'#e2e6f0', transition:'all .2s', gap:8 },
  statChip:   { background:'#161616', border:'1px solid #1e1e1e', borderRadius:7,
                padding:'7px 13px', fontSize:12, color:'#666' },
  uploadZone: { border:'2px dashed', borderRadius:12, padding:'80px 40px', textAlign:'center',
                cursor:'pointer', transition:'all .25s', marginTop:8 },

  fieldLabel: { fontSize:11, color:'#777', marginBottom:6, textTransform:'uppercase', letterSpacing:1 },
  periodPanel:{ background:'rgba(255,255,255,.02)', border:'1px solid #242424', borderRadius:10, padding:14 },
  periodHeader:{ color:'#fff', fontWeight:700, marginBottom:12, fontSize:14 },
  filterBadges:{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 },
  filterBadge:{ background:'#101010', border:'1px solid #242424', borderRadius:999, padding:'6px 10px', color:'#bbb', fontSize:12 },
  rankRow:{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid #1f1f1f' },
  rankIndex:{ width:26, height:26, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', background:'rgba(200,16,46,.16)', color:'#fff', fontWeight:700, fontSize:12 },
  cityChip:{ background:'rgba(200,16,46,.12)', border:'1px solid rgba(200,16,46,.28)', color:'#ddd', borderRadius:999, padding:'6px 10px', fontSize:12 },
};

/* ═══════════════════════════════════════════════════════════
   PAINEL LOJAS / FILIAIS
   — importa CSV "todas_as_lojas", mostra KPIs por loja,
     detecta novas lojas automaticamente e cria campos extras
═══════════════════════════════════════════════════════════ */
const FILIAIS_CONHECIDAS = {
  PRZ:'Parnamirim (Matriz)', NAB:'Natal Boa Viagem', SCR:'Santa Cruz',
  PET:'Petrolina', AJU:'Aracaju', SAL:'Salvador', FEI:'Feira de Santana',
  CGR:'Campo Grande', CRU:'Cruz das Almas', ARP:'Araripina',
  IPS:'Ipojuca', MCO:'Mossoró Centro', PAR:'Parnaíba',
  FZA:'Fortaleza', SJP:'São João do Piauí', SMP:'Simões',
  VMA:'Valença', '0NN':'Loja Nova (0NN)',
};

function PanelFiliais({ onImported }) {
  const fileRef   = useRef(null);
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState('');
  const [mode,     setMode]     = useState('substituir');
  const [kpis,     setKpis]     = useState(null);
  const [filiais,  setFiliais]  = useState([]);
  const [loading2, setLoading2] = useState(false);
  const [search,   setSearch]   = useState('');
  const [filFil,   setFilFil]   = useState('');
  const [rows,     setRows]     = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(0);
  const PER = 50;

  // Carrega KPIs e lista de filiais ao montar
  useEffect(() => { fetchKpis(); }, []);
  useEffect(() => { fetchRows(); }, [search, filFil, page]);

  async function fetchKpis() {
    try {
      const d = await apiFetch('/database/estoque-filiais?limit=1');
      setKpis(d.kpis);
      setFiliais(d.por_filial || []);
      if (d.kpis?.total_itens > 0) onImported && onImported(parseInt(d.kpis.total_itens));
    } catch {}
  }

  async function fetchRows() {
    setLoading2(true);
    try {
      const params = new URLSearchParams({
        limit: PER, offset: page * PER,
        ...(search  ? { search }          : {}),
        ...(filFil  ? { filial: filFil }  : {}),
      });
      const d = await apiFetch(`/database/estoque-filiais?${params}`);
      setRows(d.rows || []);
      setTotal(d.total || 0);
    } catch { setRows([]); }
    setLoading2(false);
  }

  async function handleFile(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    setLoading(true); setMsg('');
    try {
      let dadosBrutos = [];

      if (ext === 'csv') {
        const text = await file.text();
        const sep  = text.slice(0,500).split(';').length >= text.slice(0,500).split(',').length ? ';' : ',';
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g,'').trim()).filter(Boolean);
        dadosBrutos = lines.slice(1).map(line => {
          const vals = line.split(sep).map(v => v.replace(/^"|"$/g,'').trim());
          const obj  = {};
          headers.forEach((h,i) => { obj[h] = vals[i] ?? null; });
          return obj;
        }).filter(r => r.filial || r.referencia);

      } else if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type:'array', cellDates:true, raw:true });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        dadosBrutos = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

      } else {
        throw new Error('Formato esperado: .csv ou .xlsx');
      }

      if (dadosBrutos.length === 0) throw new Error('Arquivo vazio ou sem linhas válidas.');

      // Detecta novas lojas não mapeadas
      const codsDetectados = [...new Set(dadosBrutos.map(r => r.filial).filter(Boolean))];
      const novas = codsDetectados.filter(c => !FILIAIS_CONHECIDAS[c]);
      if (novas.length) {
        setMsg(`⚠️ Novas lojas detectadas e serão criadas automaticamente: ${novas.join(', ')}`);
        await new Promise(r => setTimeout(r, 1200));
      }

      // Envia em lotes
      const LOTE = 1000;
      let totalIns = 0;
      for (let i = 0; i < dadosBrutos.length; i += LOTE) {
        const lote    = dadosBrutos.slice(i, i + LOTE);
        const modoLote = i === 0 ? mode : 'acumular';
        setMsg(`⏳ Enviando... ${Math.min(i+LOTE, dadosBrutos.length)} / ${dadosBrutos.length}`);
        const d = await apiFetch('/database/importar-filiais', {
          method: 'POST',
          body: JSON.stringify({ dados: lote, modo: modoLote }),
        });
        totalIns += d.inserted || 0;
      }

      setMsg(`✅ ${totalIns.toLocaleString()} registros importados de ${codsDetectados.length} lojas!`);
      onImported && onImported(totalIns);
      await fetchKpis();
      setPage(0); fetchRows();

    } catch(e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
      setTimeout(() => setMsg(''), 14000);
    }
  }

  function fmtVal(v) {
    if (v == null) return '—';
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  }
  function fmtNum(v) {
    if (v == null) return '—';
    return Number(v).toLocaleString('pt-BR', { maximumFractionDigits:0 });
  }
  function fmtPct(v) {
    if (v == null) return '—';
    return Number(v).toFixed(1) + '%';
  }

  const corStatus = { 'CRITICO':'#e74c3c','ADEQUADO':'#2ecc71','EXCESSO':'#f39c12','SEM ESTOQUE':'#777' };

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={S.title}>LOJAS / FILIAIS</h1>
          <p style={S.sub}>Estoque e performance por loja — {filiais.length} loja(s) com dados</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <select value={mode} onChange={e => setMode(e.target.value)}
            style={{ background:'#161616', border:'1px solid #2a2a2a', borderRadius:7, padding:'8px 12px', color:'#aaa', fontSize:12 }}>
            <option value="substituir">Substituir todos os dados</option>
            <option value="acumular">Acumular (adicionar)</option>
          </select>
          <button onClick={() => fileRef.current?.click()} disabled={loading}
            style={{ background:'rgba(243,156,18,.14)', border:'1px solid rgba(243,156,18,.4)', borderRadius:7,
              padding:'8px 16px', color:'#f39c12', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {loading ? '⏳ Importando...' : '📥 Importar CSV das Lojas'}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:'none' }}
            onChange={e => handleFile(e.target.files?.[0])} />
        </div>
      </div>

      {/* Mensagem de status */}
      {msg && (
        <div style={{ background: msg.startsWith('✅') ? 'rgba(46,204,113,.1)' : msg.startsWith('❌') ? 'rgba(200,16,46,.1)' : 'rgba(243,156,18,.1)',
          border: `1px solid ${msg.startsWith('✅') ? '#2ecc71' : msg.startsWith('❌') ? '#e74c3c' : '#f39c12'}`,
          borderRadius:9, padding:'10px 16px', marginBottom:16, fontSize:13, color:'#ddd' }}>
          {msg}
        </div>
      )}

      {/* KPIs globais */}
      {kpis && parseInt(kpis.total_itens) > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12, marginBottom:24 }}>
          {[
            { label:'Lojas', val: fmtNum(kpis.total_lojas), icon:'🏪' },
            { label:'Itens', val: fmtNum(kpis.total_itens), icon:'📦' },
            { label:'Valor Estoque', val: fmtVal(kpis.valor_total), icon:'💰' },
            { label:'Vendas 6m', val: fmtVal(kpis.vendas_6m), icon:'📈' },
            { label:'Lucro 6m', val: fmtVal(kpis.lucro_6m), icon:'💵' },
            { label:'Margem Média', val: fmtPct(kpis.margem_media), icon:'📊' },
          ].map(k => (
            <div key={k.label} style={{ background:'#161616', border:'1px solid #1e1e1e', borderRadius:10, padding:'14px 16px' }}>
              <div style={{ fontSize:10, fontWeight:600, letterSpacing:1.5, textTransform:'uppercase', color:'#555', marginBottom:4 }}>
                {k.icon} {k.label}
              </div>
              <div style={{ fontWeight:700, fontSize:16, color:'#fff', fontFamily:'monospace' }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cards por filial */}
      {filiais.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#555', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>
            Visão por Loja
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:10 }}>
            {filiais.map(f => (
              <div key={f.filial} onClick={() => { setFilFil(f.filial === filFil ? '' : f.filial); setPage(0); }}
                style={{ background: filFil === f.filial ? 'rgba(243,156,18,.1)' : '#161616',
                  border: `1px solid ${filFil === f.filial ? 'rgba(243,156,18,.5)' : '#1e1e1e'}`,
                  borderRadius:10, padding:'12px 14px', cursor:'pointer', transition:'all .2s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontWeight:700, fontSize:13, color:'#fff' }}>
                    {f.filial}
                  </span>
                  <span style={{ fontSize:10, color:'#555', background:'#101010', padding:'2px 7px', borderRadius:6 }}>
                    {fmtNum(f.itens)} itens
                  </span>
                </div>
                <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>
                  {FILIAIS_CONHECIDAS[f.filial] || f.nome_loja || '— loja nova —'}
                </div>
                <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:13, color:'#f39c12' }}>
                  {fmtVal(f.valor)}
                </div>
                <div style={{ fontSize:11, color:'#666', marginTop:2 }}>
                  Vendas 6m: {fmtVal(f.vendas_6m)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de itens */}
      {(filiais.length > 0 || rows.length > 0) && (
        <div>
          <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
            <input placeholder="🔍 Buscar referência / descrição…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              style={{ ...S.input, maxWidth:340 }} />
            {filFil && (
              <button onClick={() => setFilFil('')}
                style={{ background:'rgba(243,156,18,.1)', border:'1px solid rgba(243,156,18,.3)', borderRadius:7,
                  padding:'8px 12px', color:'#f39c12', fontSize:12, cursor:'pointer' }}>
                ✕ Loja: {filFil}
              </button>
            )}
            <span style={{ color:'#555', fontSize:12, marginLeft:'auto' }}>
              {fmtNum(total)} resultado(s)
            </span>
          </div>

          <div style={S.tableWrap}>
            <div style={S.tableTbar}>
              <span style={{ fontWeight:700, fontSize:12, color:'#fff' }}>
                📋 Estoque por Loja
                {filFil ? ` — ${filFil}` : ''}
              </span>
            </div>
            {loading2 ? (
              <div style={{ padding:40, textAlign:'center', color:'#555', fontSize:13 }}>Carregando…</div>
            ) : rows.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', color:'#555', fontSize:13 }}>
                Nenhum dado encontrado. Importe o arquivo CSV das lojas.
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {['Loja','Referência','Descrição','Grupo','Estoque','Valor (R$)',
                        'Cobertura','Status','Vendas 6m','Margem %'].map(h => (
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i) => (
                      <tr key={i} style={{ background: i%2===0 ? 'transparent' : 'rgba(255,255,255,.01)' }}>
                        <td style={S.td}>
                          <span style={{ background:'rgba(243,156,18,.12)', border:'1px solid rgba(243,156,18,.25)',
                            borderRadius:5, padding:'2px 7px', fontWeight:700, color:'#f39c12', fontSize:11 }}>
                            {r.filial}
                          </span>
                        </td>
                        <td style={{ ...S.td, color:'#fff', fontWeight:600 }}>{r.referencia}</td>
                        <td style={{ ...S.td, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', color:'#ccc' }}>
                          {r.descricao}
                        </td>
                        <td style={S.td}>{r.grupo}</td>
                        <td style={{ ...S.td, textAlign:'right' }}>{fmtNum(r.saldo_estoque_filial)}</td>
                        <td style={{ ...S.td, textAlign:'right', color:'#2ecc71' }}>{fmtVal(r.valor_estoque_filial)}</td>
                        <td style={{ ...S.td, textAlign:'right' }}>{r.cobertura_meses_filial != null ? Number(r.cobertura_meses_filial).toFixed(1)+'m' : '—'}</td>
                        <td style={S.td}>
                          <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:5, letterSpacing:.5,
                            background: corStatus[r.status_cobertura_filial] ? corStatus[r.status_cobertura_filial]+'22' : '#1a1a1a',
                            color: corStatus[r.status_cobertura_filial] || '#777',
                            border: `1px solid ${corStatus[r.status_cobertura_filial] || '#2a2a2a'}` }}>
                            {r.status_cobertura_filial || '—'}
                          </span>
                        </td>
                        <td style={{ ...S.td, textAlign:'right' }}>{fmtVal(r.vlr_vendido_filial_6m)}</td>
                        <td style={{ ...S.td, textAlign:'right', color: r.margem_pct_filial > 0 ? '#2ecc71' : '#e74c3c' }}>
                          {fmtPct(r.margem_pct_filial)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Paginação */}
          {total > PER && (
            <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:16 }}>
              <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
                style={{ ...S.btn, ...S.btnOutline, opacity: page===0 ? .4 : 1 }}>← Anterior</button>
              <span style={{ padding:'9px 16px', fontSize:13, color:'#666' }}>
                Pág. {page+1} / {Math.ceil(total/PER)}
              </span>
              <button onClick={() => setPage(p => p+1)} disabled={(page+1)*PER >= total}
                style={{ ...S.btn, ...S.btnOutline, opacity: (page+1)*PER >= total ? .4 : 1 }}>Próxima →</button>
            </div>
          )}
        </div>
      )}

      {/* Estado vazio */}
      {filiais.length === 0 && rows.length === 0 && !loading && (
        <div onClick={() => fileRef.current?.click()}
          style={{ ...S.uploadZone, borderColor:'rgba(243,156,18,.3)', color:'#555',
            '&:hover': { borderColor:'#f39c12', background:'rgba(243,156,18,.04)' } }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🏪</div>
          <div style={{ fontWeight:700, fontSize:16, color:'#888', marginBottom:8 }}>Clique para importar o CSV de todas as lojas</div>
          <div style={{ fontSize:13, color:'#555', maxWidth:400, margin:'0 auto', lineHeight:1.6 }}>
            Arquivo esperado: <code style={{ color:'#f39c12' }}>atualizado_sql_todas_as_lojas_csv.csv</code><br/>
            Colunas: filial, referencia, descricao, grupo, saldo_estoque_filial, vlr_vendido_filial_6m…<br/>
            <strong style={{ color:'#888', marginTop:8, display:'block' }}>Novas lojas são criadas automaticamente.</strong>
          </div>
        </div>
      )}
    </div>
  );
}
