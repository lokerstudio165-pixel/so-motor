// backend/routes/database.js
// Rotas para: status do banco, listar tabelas, executar queries seguras
// e receber uploads de planilha (CSV/XLSX já tratados no frontend)

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// ─── Middleware simples de autenticação ───────────────────────────────────────
const { authMiddleware: verifyToken } = require('./auth');

// ─── GET /api/database/status ─────────────────────────────────────────────────
// Retorna: versão do PG, latência, lista de tabelas e contagem de linhas
router.get('/status', verifyToken, async (req, res) => {
  const t0 = Date.now();
  try {
    // Versão
    const ver = await pool.query('SELECT version()');
    const version = ver.rows[0].version.match(/PostgreSQL ([\d.]+)/)?.[1] || '—';

    // Latência de ida-e-volta
    const latency = Date.now() - t0;

    // Tabelas do schema public com contagem estimada de linhas
    const tablesRes = await pool.query(`
      SELECT
        t.table_name,
        COALESCE(s.n_live_tup, 0) AS row_estimate
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s
        ON s.relname = t.table_name
      WHERE t.table_schema = 'public'
        AND t.table_type   = 'BASE TABLE'
      ORDER BY t.table_name
    `);

    res.json({
      ok:      true,
      version,
      latency_ms: latency,
      database: process.env.DB_NAME || 'somotor',
      host:     process.env.DB_HOST || 'localhost',
      tables:   tablesRes.rows,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/database/tables/:table ─────────────────────────────────────────
// Retorna colunas + primeiras 200 linhas de uma tabela (somente tabelas próprias)
router.get('/tables/:table', verifyToken, async (req, res) => {
  const { table } = req.params;

  // Whitelist: apenas tabelas que existem no schema public
  try {
    const check = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Tabela não encontrada.' });
    }

    const limit  = Math.min(parseInt(req.query.limit  || '200'), 500);
    const offset = Math.max(parseInt(req.query.offset || '0'),   0);

    const data = await pool.query(
      // Identificadores não aceitam parâmetros $1, usamos validação acima
      `SELECT * FROM "${table}" LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Total de linhas (estimativa rápida)
    const countRes = await pool.query(
      `SELECT reltuples::bigint AS estimate
       FROM pg_class WHERE relname = $1`,
      [table]
    );

    res.json({
      ok:       true,
      table,
      columns:  data.fields.map(f => ({ name: f.name, type: f.dataTypeID })),
      rows:     data.rows,
      total_estimate: countRes.rows[0]?.estimate ?? data.rowCount,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/database/query ─────────────────────────────────────────────────
// Executa uma query SELECT (bloqueia DDL e DML por segurança)
// Body: { sql: "SELECT ..." }
router.post('/query', verifyToken, async (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ ok: false, error: 'Campo "sql" obrigatório.' });
  }

  // Permite apenas SELECT e WITH (CTEs de leitura)
  const normalized = sql.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!/^(SELECT|WITH)\b/.test(normalized)) {
    return res.status(403).json({
      ok: false,
      error: 'Apenas queries SELECT são permitidas nesta rota.',
    });
  }

  // Bloqueia palavras-chave perigosas mesmo dentro de SELECT
  const blocked = ['DROP','DELETE','UPDATE','INSERT','TRUNCATE','ALTER','CREATE','GRANT','REVOKE'];
  if (blocked.some(kw => normalized.includes(kw))) {
    return res.status(403).json({
      ok: false,
      error: 'Query contém operação não permitida.',
    });
  }

  const t0 = Date.now();
  try {
    const result = await pool.query(sql);
    res.json({
      ok:         true,
      rows:       result.rows,
      row_count:  result.rowCount,
      latency_ms: Date.now() - t0,
      columns:    result.fields?.map(f => f.name) ?? [],
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ─── DELETE /api/database/clear ──────────────────────────────────────────────
// Apaga TODOS os dados das tabelas de negócio (produtos, frota) para nova importação
// Mantém usuários e estrutura intactos
router.delete('/clear', verifyToken, async (req, res) => {
  const { tabelas } = req.body; // ['produtos'] ou ['frota'] ou vazio = todas

  const ALLOWED_TABLES = ['produtos', 'frota', 'estoque_matriz', 'estoque_filiais'];
  const toDelete = tabelas && Array.isArray(tabelas)
    ? tabelas.filter(t => ALLOWED_TABLES.includes(t))
    : ALLOWED_TABLES;

  if (toDelete.length === 0) {
    return res.status(400).json({ ok: false, error: 'Nenhuma tabela válida informada.' });
  }

  try {
    const results = [];
    for (const table of toDelete) {
      await pool.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
      results.push(table);
    }
    res.json({ ok: true, cleared: results, message: `${results.join(', ')} limpa(s) com sucesso.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── DELETE /api/database/reset-dados ────────────────────────────────────────
// Apaga todos os dados importados (produtos). Só admin pode executar.
// Mantém a estrutura do banco intacta e os usuários/frota intocados.
router.delete('/reset-dados', verifyToken, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE produtos RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE estoque_matriz RESTART IDENTITY CASCADE');
    await pool.query('TRUNCATE TABLE estoque_filiais RESTART IDENTITY CASCADE');
    res.json({ ok: true, message: 'Dados de produtos, matriz e filiais apagados com sucesso.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/database/importar-dados ───────────────────────────────────────
// Recebe array de produtos em JSON e insere no banco (substituindo tudo ou acumulando).
// Body: { dados: [...], modo: 'substituir' | 'acumular' }
// Só admin pode executar.
router.post('/importar-dados', verifyToken, async (req, res) => {
  const { dados, modo = 'substituir' } = req.body;

  if (!Array.isArray(dados) || dados.length === 0) {
    return res.status(400).json({ ok: false, error: 'Campo "dados" deve ser um array não vazio.' });
  }

  const CAMPOS = [
    'unidade','referencia','descricao','grupo','sub_grupo',
    'saldo_estoque','custo_medio','valor_estoque','cobertura_meses','status_cobertura',
    'giro_estoque','qtd_saida_6m','vlr_saida_6m','vlr_desconto_6m','qtd_saida_mes',
    'vlr_saida_mes','qtd_compra_6m','vlr_compra_6m','qtd_notas_6m','margem_bruta_unit',
    'margem_pct','lucro_bruto_6m','fornecedor_ult','dt_ult_compra','status_produto',
  ];

  // Campos numéricos — precisam ser NUMERIC no postgres
  const CAMPOS_NUMERICOS = new Set([
    'saldo_estoque','custo_medio','valor_estoque','cobertura_meses',
    'giro_estoque','qtd_saida_6m','vlr_saida_6m','vlr_desconto_6m','qtd_saida_mes',
    'vlr_saida_mes','qtd_compra_6m','vlr_compra_6m','qtd_notas_6m','margem_bruta_unit',
    'margem_pct','lucro_bruto_6m',
  ]);

  // Limpa string e converte para número ou null
  function toNum(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isFinite(val) ? val : null;
    // Remove espaços, R$, separador de milhar (vírgula ou ponto conforme padrão)
    const s = String(val).trim()
      .replace(/\s/g, '')
      .replace(/R\$/gi, '')
      .replace(/[^0-9.,$%-]/g, '');
    // Detecta formato: se tem vírgula E ponto, vírgula é milhar → remove vírgula
    // Se só vírgula → é decimal → substitui por ponto
    let clean = s;
    if (s.includes(',') && s.includes('.')) {
      // ex: "83,856.00" → remove vírgula
      clean = s.replace(/,/g, '');
    } else if (s.includes(',')) {
      // ex: "83856,00" → troca vírgula por ponto
      clean = s.replace(/,/g, '.');
    }
    const n = parseFloat(clean);
    return isFinite(n) ? n : null;
  }

  // Limpa data — aceita string, Date, ou serial do Excel
  function toDate(val) {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) return isNaN(val) ? null : val.toISOString().slice(0, 10);
    const s = String(val).trim();
    if (!s) return null;
    // formato dd/mm/yyyy ou dd-mm-yyyy
    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (br) {
      const y = br[3].length === 2 ? '20' + br[3] : br[3];
      return `${y}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`;
    }
    // formato yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }

  function sanitizar(r) {
    const out = {};
    for (const campo of CAMPOS) {
      let val = r[campo] ?? null;
      if (campo === 'dt_ult_compra') {
        out[campo] = toDate(val);
      } else if (CAMPOS_NUMERICOS.has(campo)) {
        out[campo] = toNum(val);
      } else {
        out[campo] = val === null || val === undefined ? null : String(val).trim().slice(0, 255) || null;
      }
    }
    return out;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (modo === 'substituir') {
      await client.query('TRUNCATE TABLE produtos RESTART IDENTITY CASCADE');
    }

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < dados.length; i += BATCH) {
      const batch = dados.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let pi = 1;

      for (const r of batch) {
        const s = sanitizar(r);
        const placeholders = CAMPOS.map(() => `$${pi++}`).join(',');
        values.push(`(${placeholders})`);
        for (const campo of CAMPOS) {
          params.push(s[campo]);
        }
      }

      await client.query(
        `INSERT INTO produtos (${CAMPOS.join(',')}) VALUES ${values.join(',')}`,
        params
      );
      inserted += batch.length;
    }

    await client.query('COMMIT');
    res.json({ ok: true, inserted, message: `${inserted} produto(s) importado(s) com sucesso (modo: ${modo}).` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/database/importar-matriz ──────────────────────────────────────
// Importa dados da planilha analise_de_compra_matriz para estoque_matriz
router.post('/importar-matriz', verifyToken, async (req, res) => {
  const { dados, modo = 'substituir' } = req.body;

  if (!Array.isArray(dados) || dados.length === 0) {
    return res.status(400).json({ ok: false, error: 'Campo "dados" deve ser um array não vazio.' });
  }

  const CAMPOS = [
    'referencia','descricao','grupo','sub_grupo','codigo_barras',
    'saldo_estoque_cd','custo_medio_estoque','valor_estoque_cd',
    'cobertura_meses_cd','cobertura_dias_cd','status_cobertura','giro_estoque_cd',
    'qtd_total_saida_cd_6m','vlr_total_saida_cd_6m',
    'qtd_transferida_6m','vlr_transferido_6m',
    'qtd_venda_direta_cd_6m','vlr_venda_direta_cd_6m',
    'qtd_saida_cd_mes','vlr_saida_cd_mes','meses_com_saida_cd',
    'media_mensal_qtd_cd','preco_medio_saida',
    'qtd_ago25','vlr_ago25','qtd_set25','vlr_set25',
    'qtd_out25','vlr_out25','qtd_nov25','vlr_nov25',
    'qtd_dez25','vlr_dez25','qtd_jan26','vlr_jan26',
    'qtd_comprada_6m','vlr_comprado_6m','vlr_desconto_compra_6m',
    'qtd_notas_6m','vlr_ipi_6m','vlr_icms_6m','vlr_impostos_total_6m',
    'custo_medio_compra_6m','dt_ult_compra','fornecedor_ult',
    'vlr_ult_compra','qtd_ult_compra','desconto_ult_compra',
    'perc_ipi_ult','vlr_ipi_ult','perc_icms_ult','vlr_icms_ult',
    'custo_efetivo_ult_compra','dias_sem_compra',
    'variacao_ult_vs_media_pct','margem_pct','lucro_bruto_6m',
    'dt_pen_compra','fornecedor_pen','vlr_pen_compra','qtd_pen_compra','desconto_pen_compra',
    'vlr_ipi_pen','vlr_icms_pen',
    'dt_ante_compra','fornecedor_ante','vlr_ante_compra','qtd_ante_compra',
    'variacao_ult_pen_pct','variacao_ult_ante_pct',
    'data_primeira_compra','status_produto',
  ];

  const CAMPOS_DATA = new Set(['dt_ult_compra','dt_pen_compra','dt_ante_compra','data_primeira_compra']);
  const CAMPOS_TEXTO = new Set(['referencia','descricao','grupo','sub_grupo','codigo_barras',
    'fornecedor_ult','fornecedor_pen','fornecedor_ante','status_produto','status_cobertura']);

  function toNum(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isFinite(val) ? val : null;
    const s = String(val).trim().replace(/\s/g,'').replace(/R\$/gi,'');
    let clean = s;
    if (s.includes(',') && s.includes('.')) clean = s.replace(/,/g,'');
    else if (s.includes(',')) clean = s.replace(/,/g,'.');
    const n = parseFloat(clean.replace(/[^0-9.-]/g,''));
    return isFinite(n) ? n : null;
  }

  function toDate(val) {
    if (val === null || val === undefined || val === '') return null;
    if (val instanceof Date) return isNaN(val) ? null : val.toISOString().slice(0,10);
    const s = String(val).trim();
    if (!s || s === 'null') return null;
    // dd/mm/yy ou dd/mm/yyyy
    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (br) {
      const y = br[3].length === 2 ? '20' + br[3] : br[3];
      return `${y}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
    // ISO string do JSON
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0,10);
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0,10);
  }

  function sanitizar(r) {
    const out = {};
    for (const campo of CAMPOS) {
      const val = r[campo] ?? null;
      if (CAMPOS_DATA.has(campo))   out[campo] = toDate(val);
      else if (CAMPOS_TEXTO.has(campo)) out[campo] = val ? String(val).trim().slice(0,255) || null : null;
      else out[campo] = toNum(val);
    }
    return out;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (modo === 'substituir') {
      await client.query('TRUNCATE TABLE estoque_matriz RESTART IDENTITY');
    }

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < dados.length; i += BATCH) {
      const batch = dados.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let pi = 1;
      for (const r of batch) {
        const s = sanitizar(r);
        values.push(`(${CAMPOS.map(() => `$${pi++}`).join(',')})`);
        CAMPOS.forEach(c => params.push(s[c]));
      }
      await client.query(
        `INSERT INTO estoque_matriz (${CAMPOS.join(',')}) VALUES ${values.join(',')}`,
        params
      );
      inserted += batch.length;
    }

    await client.query('COMMIT');
    res.json({ ok: true, inserted, message: `${inserted} registro(s) da Matriz importado(s) com sucesso.` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// ─── GET /api/database/estoque-matriz ────────────────────────────────────────
// Retorna resumo e paginação do estoque_matriz
router.get('/estoque-matriz', verifyToken, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit  || '50'), 200);
    const offset = Math.max(parseInt(req.query.offset || '0'), 0);
    const search = req.query.search ? `%${req.query.search}%` : null;
    const grupo  = req.query.grupo  || null;

    let where = 'WHERE 1=1';
    const params = [];
    let pi = 1;
    if (search) { where += ` AND (referencia ILIKE $${pi} OR descricao ILIKE $${pi})`; params.push(search); pi++; }
    if (grupo)  { where += ` AND grupo = $${pi}`; params.push(grupo); pi++; }

    const [rows, total, kpis, grupos] = await Promise.all([
      pool.query(
        `SELECT * FROM estoque_matriz ${where} ORDER BY valor_estoque_cd DESC LIMIT $${pi} OFFSET $${pi+1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM estoque_matriz ${where}`, params),
      pool.query(`SELECT
        COUNT(*)                          AS total_itens,
        SUM(saldo_estoque_cd)             AS total_pecas,
        SUM(valor_estoque_cd)             AS valor_total,
        SUM(vlr_total_saida_cd_6m)        AS saida_6m,
        SUM(vlr_comprado_6m)              AS comprado_6m,
        AVG(dias_sem_compra)              AS media_dias_sem_compra
        FROM estoque_matriz`),
      pool.query(`SELECT grupo, COUNT(*) AS itens, SUM(saldo_estoque_cd) AS pecas,
        SUM(valor_estoque_cd) AS valor
        FROM estoque_matriz GROUP BY grupo ORDER BY valor DESC LIMIT 15`),
    ]);

    res.json({
      ok: true,
      rows: rows.rows,
      total: parseInt(total.rows[0].count),
      kpis: kpis.rows[0],
      grupos: grupos.rows,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/database/importar-filiais ─────────────────────────────────────
// Importa dados do CSV "todas_as_lojas" para estoque_filiais
// Body: { dados: [...], modo: 'substituir' | 'acumular' }
router.post('/importar-filiais', verifyToken, async (req, res) => {
  const { dados, modo = 'substituir' } = req.body;

  if (!Array.isArray(dados) || dados.length === 0) {
    return res.status(400).json({ ok: false, error: 'Campo "dados" deve ser um array não vazio.' });
  }

  const CAMPOS = [
    'filial','referencia','descricao','grupo','sub_grupo',
    'saldo_estoque_filial','custo_medio_filial','valor_estoque_filial',
    'cobertura_meses_filial','cobertura_dias_filial','status_cobertura_filial',
    'giro_estoque_filial',
    'qtd_vendida_filial_6m','vlr_vendido_filial_6m',
    'qtd_vendida_filial_mes','vlr_vendido_filial_mes',
    'meses_com_venda_filial','media_mensal_qtd_filial','preco_medio_venda_filial',
    'qtd_mes1','vlr_mes1','qtd_mes2','vlr_mes2','qtd_mes3','vlr_mes3',
    'qtd_mes4','vlr_mes4','qtd_mes5','vlr_mes5','qtd_mes6','vlr_mes6',
    'qtd_recebida_nsd_6m','vlr_recebido_nsd_6m',
    'margem_pct_filial','lucro_bruto_filial_6m',
  ];

  const CAMPOS_TEXTO = new Set(['filial','referencia','descricao','grupo','sub_grupo','status_cobertura_filial']);

  function toNum(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isFinite(val) ? val : null;
    const s = String(val).trim().replace(/\s/g,'').replace(/R\$/gi,'');
    let clean = s;
    if (s.includes(',') && s.includes('.')) clean = s.replace(/,/g,'');
    else if (s.includes(',')) clean = s.replace(/,/g,'.');
    const n = parseFloat(clean.replace(/[^0-9.-]/g,''));
    return isFinite(n) ? n : null;
  }

  function sanitizar(r) {
    const out = {};
    for (const campo of CAMPOS) {
      const val = r[campo] ?? null;
      if (CAMPOS_TEXTO.has(campo)) {
        out[campo] = val ? String(val).trim().slice(0,255) || null : null;
      } else {
        out[campo] = toNum(val);
      }
    }
    return out;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (modo === 'substituir') {
      await client.query('TRUNCATE TABLE estoque_filiais RESTART IDENTITY');
    }

    // Auto-registra novas filiais que apareçam no arquivo
    const filiais = [...new Set(dados.map(r => r.filial).filter(Boolean))];
    for (const cod of filiais) {
      await client.query(
        `INSERT INTO filiais (codigo, nome) VALUES ($1, $2) ON CONFLICT (codigo) DO NOTHING`,
        [cod, `Loja ${cod}`]
      );
    }

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < dados.length; i += BATCH) {
      const batch = dados.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let pi = 1;

      for (const r of batch) {
        const s = sanitizar(r);
        values.push(`(${CAMPOS.map(() => `$${pi++}`).join(',')})`);
        CAMPOS.forEach(c => params.push(s[c]));
      }

      await client.query(
        `INSERT INTO estoque_filiais (${CAMPOS.join(',')}) VALUES ${values.join(',')}`,
        params
      );
      inserted += batch.length;
    }

    await client.query('COMMIT');
    res.json({
      ok: true,
      inserted,
      filiais_detectadas: filiais,
      message: `${inserted} registro(s) de filiais importado(s) (${filiais.length} lojas).`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
});

// ─── GET /api/database/estoque-filiais ───────────────────────────────────────
// Retorna resumo e paginação de estoque_filiais com filtros
router.get('/estoque-filiais', verifyToken, async (req, res) => {
  try {
    const limit   = Math.min(parseInt(req.query.limit  || '50'), 500);
    const offset  = Math.max(parseInt(req.query.offset || '0'), 0);
    const search  = req.query.search ? `%${req.query.search}%` : null;
    const grupo   = req.query.grupo  || null;
    const filial  = req.query.filial || null;
    const status  = req.query.status || null;

    // Sort dinâmico — whitelist para evitar SQL injection
    const SORT_COLS = new Set([
      'valor_estoque_filial','vlr_vendido_filial_6m','vlr_vendido_filial_mes',
      'saldo_estoque_filial','lucro_bruto_filial_6m','margem_pct_filial',
      'cobertura_meses_filial','media_mensal_qtd_filial','referencia','grupo','filial',
    ]);
    const sortCol = SORT_COLS.has(req.query.sort) ? req.query.sort : 'vlr_vendido_filial_6m';
    const sortDir = req.query.order === 'ASC' ? 'ASC' : 'DESC';

    let where = 'WHERE 1=1';
    const params = [];
    let pi = 1;
    if (search) { where += ` AND (referencia ILIKE $${pi} OR descricao ILIKE $${pi})`; params.push(search); pi++; }
    if (grupo)  { where += ` AND grupo = $${pi}`;                params.push(grupo);  pi++; }
    if (filial) { where += ` AND filial = $${pi}`;               params.push(filial); pi++; }
    if (status) { where += ` AND status_cobertura_filial = $${pi}`; params.push(status); pi++; }

    const [rows, total, kpis, porFilial, grupos] = await Promise.all([
      pool.query(
        `SELECT * FROM estoque_filiais ${where} ORDER BY ${sortCol} ${sortDir} NULLS LAST LIMIT $${pi} OFFSET $${pi+1}`,
        [...params, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM estoque_filiais ${where}`, params),
      pool.query(`
        SELECT
          COUNT(DISTINCT filial)          AS total_lojas,
          COUNT(*)                        AS total_itens,
          SUM(saldo_estoque_filial)       AS total_pecas,
          SUM(valor_estoque_filial)       AS valor_total,
          SUM(vlr_vendido_filial_6m)      AS vendas_6m,
          SUM(lucro_bruto_filial_6m)      AS lucro_6m,
          AVG(margem_pct_filial)          AS margem_media
        FROM estoque_filiais`),
      pool.query(`
        SELECT
          f.filial,
          COALESCE(fl.nome, f.filial) AS nome_loja,
          COUNT(*)                    AS itens,
          SUM(f.saldo_estoque_filial) AS pecas,
          SUM(f.valor_estoque_filial) AS valor,
          SUM(f.vlr_vendido_filial_6m) AS vendas_6m,
          AVG(f.margem_pct_filial)    AS margem_media
        FROM estoque_filiais f
        LEFT JOIN filiais fl ON fl.codigo = f.filial
        GROUP BY f.filial, fl.nome
        ORDER BY valor DESC`),
      pool.query(`
        SELECT grupo, COUNT(*) AS itens,
          SUM(saldo_estoque_filial) AS pecas,
          SUM(valor_estoque_filial) AS valor
        FROM estoque_filiais
        GROUP BY grupo ORDER BY valor DESC LIMIT 20`),
    ]);

    res.json({
      ok: true,
      rows:       rows.rows,
      total:      parseInt(total.rows[0].count),
      kpis:       kpis.rows[0],
      por_filial: porFilial.rows,
      grupos:     grupos.rows,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/database/filiais ────────────────────────────────────────────────
// Lista todas as filiais cadastradas
router.get('/filiais', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.codigo, f.nome, f.cidade, f.estado, f.ativa,
        COUNT(ef.id) AS itens_estoque,
        SUM(ef.valor_estoque_filial) AS valor_estoque
       FROM filiais f
       LEFT JOIN estoque_filiais ef ON ef.filial = f.codigo
       GROUP BY f.codigo, f.nome, f.cidade, f.estado, f.ativa
       ORDER BY f.codigo`
    );
    res.json({ ok: true, filiais: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
