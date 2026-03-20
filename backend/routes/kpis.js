// routes/kpis.js — KPIs orientados às planilhas reais
const express = require('express');
const pool    = require('../db');
const { authMiddleware } = require('./auth');
const router  = express.Router();

// ─── GET /api/kpis/filiais-resumo ─────────────────────────────
// KPIs consolidados de todas as filiais (aba principal do dashboard)
router.get('/filiais-resumo', authMiddleware, async (req, res) => {
  const { filial } = req.query;
  const where  = filial && filial !== 'Todas' ? 'WHERE filial = $1' : '';
  const params = filial && filial !== 'Todas' ? [filial] : [];
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT filial)              AS total_lojas,
        COUNT(*)                            AS total_itens,
        SUM(saldo_estoque_filial)           AS total_pecas,
        SUM(valor_estoque_filial)           AS valor_total_estoque,
        SUM(vlr_vendido_filial_6m)          AS total_vendas_6m,
        SUM(vlr_vendido_filial_mes)         AS total_vendas_mes,
        SUM(lucro_bruto_filial_6m)          AS total_lucro_6m,
        ROUND(
          SUM(lucro_bruto_filial_6m) /
          NULLIF(SUM(vlr_vendido_filial_6m),0) * 100, 1
        )                                   AS margem_real,
        ROUND(AVG(margem_pct_filial),1)     AS margem_media,
        SUM(qtd_recebida_nsd_6m)            AS total_recebido_nsd,
        SUM(vlr_recebido_nsd_6m)            AS vlr_recebido_nsd,
        COUNT(*) FILTER (WHERE status_cobertura_filial = 'CRITICO')     AS criticos,
        COUNT(*) FILTER (WHERE status_cobertura_filial = 'SEM ESTOQUE') AS sem_estoque,
        COUNT(*) FILTER (WHERE status_cobertura_filial = 'EXCESSO')     AS excesso,
        COUNT(*) FILTER (WHERE status_cobertura_filial = 'ADEQUADO')    AS adequado,
        COUNT(*) FILTER (WHERE status_cobertura_filial = 'BAIXO')       AS baixo,
        COUNT(*) FILTER (WHERE status_cobertura_filial = 'SEM VENDA')   AS sem_venda
      FROM estoque_filiais ${where}
    `, params);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/kpis/filiais ────────────────────────────────────
// Performance por loja
router.get('/filiais', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ef.filial,
        COALESCE(fl.nome, ef.filial)          AS nome_loja,
        fl.cidade, fl.estado,
        COUNT(*)                              AS total_itens,
        SUM(ef.saldo_estoque_filial)          AS total_pecas,
        SUM(ef.valor_estoque_filial)          AS valor_estoque,
        SUM(ef.vlr_vendido_filial_6m)         AS vendas_6m,
        SUM(ef.vlr_vendido_filial_mes)        AS vendas_mes,
        SUM(ef.lucro_bruto_filial_6m)         AS lucro_6m,
        ROUND(SUM(ef.lucro_bruto_filial_6m)/NULLIF(SUM(ef.vlr_vendido_filial_6m),0)*100,1) AS margem_real,
        ROUND(AVG(ef.margem_pct_filial),1)    AS margem_media,
        ROUND(AVG(ef.cobertura_meses_filial),1) AS cobertura_media,
        SUM(ef.qtd_recebida_nsd_6m)           AS recebido_nsd,
        SUM(ef.vlr_recebido_nsd_6m)           AS vlr_nsd,
        COUNT(*) FILTER (WHERE ef.status_cobertura_filial = 'CRITICO')     AS criticos,
        COUNT(*) FILTER (WHERE ef.status_cobertura_filial = 'SEM ESTOQUE') AS sem_estoque,
        COUNT(*) FILTER (WHERE ef.status_cobertura_filial = 'EXCESSO')     AS excesso,
        COUNT(*) FILTER (WHERE ef.status_cobertura_filial = 'ADEQUADO')    AS adequado,
        COUNT(*) FILTER (WHERE ef.status_cobertura_filial = 'SEM VENDA')   AS sem_venda
      FROM estoque_filiais ef
      LEFT JOIN filiais fl ON fl.codigo = ef.filial
      GROUP BY ef.filial, fl.nome, fl.cidade, fl.estado
      ORDER BY SUM(ef.vlr_vendido_filial_6m) DESC NULLS LAST
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/kpis/tendencia-mensal ──────────────────────────
// Evolução mensal (mes1=recente, mes6=antigo) para gráfico de linha
router.get('/tendencia-mensal', authMiddleware, async (req, res) => {
  const { filial } = req.query;
  const where  = filial && filial !== 'Todas' ? 'WHERE filial = $1' : '';
  const params = filial && filial !== 'Todas' ? [filial] : [];
  try {
    const { rows } = await pool.query(`
      SELECT
        SUM(vlr_mes1) AS m1, SUM(vlr_mes2) AS m2,
        SUM(vlr_mes3) AS m3, SUM(vlr_mes4) AS m4,
        SUM(vlr_mes5) AS m5, SUM(vlr_mes6) AS m6,
        SUM(qtd_mes1) AS q1, SUM(qtd_mes2) AS q2,
        SUM(qtd_mes3) AS q3, SUM(qtd_mes4) AS q4,
        SUM(qtd_mes5) AS q5, SUM(qtd_mes6) AS q6
      FROM estoque_filiais ${where}
    `, params);
    // mes6 = mais antigo, mes1 = mais recente → inverter para exibir cronológico
    const r = rows[0];
    res.json([
      { mes: 'Ago/25', vendas: +r.m6||0, qtd: +r.q6||0 },
      { mes: 'Set/25', vendas: +r.m5||0, qtd: +r.q5||0 },
      { mes: 'Out/25', vendas: +r.m4||0, qtd: +r.q4||0 },
      { mes: 'Nov/25', vendas: +r.m3||0, qtd: +r.q3||0 },
      { mes: 'Dez/25', vendas: +r.m2||0, qtd: +r.q2||0 },
      { mes: 'Jan/26', vendas: +r.m1||0, qtd: +r.q1||0 },
    ]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/kpis/grupos-filiais ────────────────────────────
router.get('/grupos-filiais', authMiddleware, async (req, res) => {
  const { filial, limit = 10 } = req.query;
  const conds = ['1=1'];
  const params = [];
  if (filial && filial !== 'Todas') { conds.push(`filial = $${params.length+1}`); params.push(filial); }
  params.push(parseInt(limit));
  try {
    const { rows } = await pool.query(`
      SELECT
        grupo,
        COUNT(*)                        AS total_itens,
        SUM(valor_estoque_filial)       AS valor_estoque,
        SUM(vlr_vendido_filial_6m)      AS vlr_vendido_6m,
        SUM(lucro_bruto_filial_6m)      AS lucro_6m,
        ROUND(SUM(lucro_bruto_filial_6m)/NULLIF(SUM(vlr_vendido_filial_6m),0)*100,1) AS margem_pct
      FROM estoque_filiais
      WHERE ${conds.join(' AND ')}
      GROUP BY grupo
      ORDER BY vlr_vendido_6m DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/kpis/matriz-resumo ─────────────────────────────
// KPIs do estoque CD (aba matriz)
router.get('/matriz-resumo', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                              AS total_itens,
        SUM(saldo_estoque_cd)                 AS total_pecas,
        SUM(valor_estoque_cd)                 AS valor_estoque,
        SUM(vlr_total_saida_cd_6m)            AS saidas_6m,
        SUM(vlr_comprado_6m)                  AS comprado_6m,
        SUM(lucro_bruto_6m)                   AS lucro_6m,
        ROUND(SUM(lucro_bruto_6m)/NULLIF(SUM(vlr_total_saida_cd_6m),0)*100,1) AS margem_pct,
        ROUND(AVG(dias_sem_compra),0)         AS media_dias_sem_compra,
        COUNT(*) FILTER (WHERE status_cobertura = 'CRITICO')     AS criticos,
        COUNT(*) FILTER (WHERE status_cobertura = 'SEM ESTOQUE') AS sem_estoque,
        COUNT(*) FILTER (WHERE status_cobertura = 'EXCESSO')     AS excesso,
        COUNT(*) FILTER (WHERE status_cobertura = 'ADEQUADO')    AS adequado,
        COUNT(*) FILTER (WHERE status_produto  = 'SEM COMPRA 6M') AS sem_compra
      FROM estoque_matriz
    `);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/kpis/tendencia-matriz ──────────────────────────
router.get('/tendencia-matriz', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        SUM(vlr_ago25) AS ago, SUM(vlr_set25) AS set25,
        SUM(vlr_out25) AS out25, SUM(vlr_nov25) AS nov,
        SUM(vlr_dez25) AS dez, SUM(vlr_jan26) AS jan
      FROM estoque_matriz
    `);
    const r = rows[0];
    res.json([
      { mes:'Ago/25', vendas:+r.ago||0 },
      { mes:'Set/25', vendas:+r.set25||0 },
      { mes:'Out/25', vendas:+r.out25||0 },
      { mes:'Nov/25', vendas:+r.nov||0 },
      { mes:'Dez/25', vendas:+r.dez||0 },
      { mes:'Jan/26', vendas:+r.jan||0 },
    ]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/kpis/grupos-matriz ─────────────────────────────
router.get('/grupos-matriz', authMiddleware, async (req, res) => {
  const { limit = 10 } = req.query;
  try {
    const { rows } = await pool.query(`
      SELECT
        grupo,
        COUNT(*)                            AS total_itens,
        SUM(valor_estoque_cd)               AS valor_estoque,
        SUM(vlr_total_saida_cd_6m)          AS saidas_6m,
        SUM(vlr_comprado_6m)                AS comprado_6m,
        SUM(lucro_bruto_6m)                 AS lucro_6m,
        ROUND(SUM(lucro_bruto_6m)/NULLIF(SUM(vlr_total_saida_cd_6m),0)*100,1) AS margem_pct
      FROM estoque_matriz
      GROUP BY grupo
      ORDER BY saidas_6m DESC
      LIMIT $1
    `, [parseInt(limit)]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/kpis/top-itens-filiais ─────────────────────────
router.get('/top-itens-filiais', authMiddleware, async (req, res) => {
  const { filial, limit = 15 } = req.query;
  const conds = ['vlr_vendido_filial_6m > 0'];
  const params = [];
  if (filial && filial !== 'Todas') { conds.push(`filial = $${params.length+1}`); params.push(filial); }
  params.push(parseInt(limit));
  try {
    const { rows } = await pool.query(`
      SELECT
        filial, referencia, descricao, grupo, sub_grupo,
        saldo_estoque_filial, valor_estoque_filial,
        vlr_vendido_filial_6m, vlr_vendido_filial_mes,
        margem_pct_filial, lucro_bruto_filial_6m,
        cobertura_meses_filial, status_cobertura_filial,
        media_mensal_qtd_filial, preco_medio_venda_filial
      FROM estoque_filiais
      WHERE ${conds.join(' AND ')}
      ORDER BY vlr_vendido_filial_6m DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Rotas legadas (mantidas para compatibilidade) ────────────
router.get('/',              authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*) AS total_itens, 0 AS total_estoque, 0 AS total_vendas, 0 AS total_lucro, 0 AS total_notas, 0 AS margem_pct, 0 AS ticket_medio, 0 AS giro_estoque, 0 AS criticos, 0 AS sem_estoque, 0 AS excesso, 0 AS adequado, 0 AS sem_venda, 0 AS baixo FROM produtos`);
    res.json(rows[0]);
  } catch { res.json({ total_itens:0, total_estoque:0, total_vendas:0, total_lucro:0, total_notas:0, margem_pct:0, ticket_medio:0, giro_estoque:0, criticos:0, sem_estoque:0, excesso:0, adequado:0, sem_venda:0, baixo:0 }); }
});
router.get('/grupos',        authMiddleware, async (req, res) => { try { const {rows} = await pool.query(`SELECT grupo, 0 AS vlr_saida_6m, 0 AS valor_estoque, 0 AS lucro_bruto_6m, 0 AS margem_pct FROM produtos GROUP BY grupo LIMIT 10`); res.json(rows); } catch { res.json([]); } });
router.get('/cobertura',     authMiddleware, async (req, res) => { try { const {rows} = await pool.query(`SELECT status_cobertura, COUNT(*) AS total FROM produtos GROUP BY status_cobertura`); res.json(rows); } catch { res.json([]); } });
router.get('/margem-grupo',  authMiddleware, async (req, res) => { res.json([]); });

module.exports = router;

// ─── GET /api/kpis/cobertura-filiais ─────────────────────────
// Distribuição de status de cobertura + itens críticos por filial
router.get('/cobertura-filiais', authMiddleware, async (req, res) => {
  const { filial } = req.query;
  const where  = filial && filial !== 'Todas' ? 'WHERE filial = $1' : '';
  const params = filial && filial !== 'Todas' ? [filial] : [];
  try {
    const [dist, criticos] = await Promise.all([
      pool.query(`
        SELECT
          status_cobertura_filial AS status,
          COUNT(*)                AS total,
          SUM(valor_estoque_filial)  AS valor_estoque,
          SUM(vlr_vendido_filial_6m) AS vendas_6m
        FROM estoque_filiais ${where}
        GROUP BY status_cobertura_filial
        ORDER BY total DESC
      `, params),
      pool.query(`
        SELECT
          filial, referencia, descricao, grupo, sub_grupo,
          saldo_estoque_filial, valor_estoque_filial,
          vlr_vendido_filial_6m, vlr_vendido_filial_mes,
          cobertura_meses_filial, status_cobertura_filial,
          margem_pct_filial, lucro_bruto_filial_6m,
          media_mensal_qtd_filial, preco_medio_venda_filial
        FROM estoque_filiais
        ${where ? where + ' AND' : 'WHERE'} status_cobertura_filial IN ('CRITICO','SEM ESTOQUE')
        ORDER BY vlr_vendido_filial_6m DESC
        LIMIT 100
      `, params),
    ]);
    res.json({ distribuicao: dist.rows, criticos: criticos.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/kpis/grupos-detalhes ───────────────────────────
// Grupos com breakdown por filial e tendência
router.get('/grupos-detalhes', authMiddleware, async (req, res) => {
  const { grupo, filial } = req.query;
  const conds = ['1=1'];
  const params = [];
  if (grupo)  { conds.push(`grupo = $${params.length+1}`); params.push(grupo); }
  if (filial && filial !== 'Todas') { conds.push(`filial = $${params.length+1}`); params.push(filial); }
  try {
    const [geral, porFilial, topItens, tendencia] = await Promise.all([
      // resumo do grupo
      pool.query(`
        SELECT
          grupo,
          COUNT(*)                        AS total_itens,
          COUNT(DISTINCT filial)          AS lojas,
          SUM(saldo_estoque_filial)       AS total_pecas,
          SUM(valor_estoque_filial)       AS valor_estoque,
          SUM(vlr_vendido_filial_6m)      AS vendas_6m,
          SUM(vlr_vendido_filial_mes)     AS vendas_mes,
          SUM(lucro_bruto_filial_6m)      AS lucro_6m,
          ROUND(SUM(lucro_bruto_filial_6m)/NULLIF(SUM(vlr_vendido_filial_6m),0)*100,1) AS margem_real,
          COUNT(*) FILTER (WHERE status_cobertura_filial='CRITICO')     AS criticos,
          COUNT(*) FILTER (WHERE status_cobertura_filial='SEM ESTOQUE') AS sem_estoque,
          COUNT(*) FILTER (WHERE status_cobertura_filial='EXCESSO')     AS excesso,
          COUNT(*) FILTER (WHERE status_cobertura_filial='ADEQUADO')    AS adequado,
          COUNT(*) FILTER (WHERE status_cobertura_filial='SEM VENDA')   AS sem_venda
        FROM estoque_filiais
        WHERE ${conds.join(' AND ')}
        GROUP BY grupo ORDER BY vendas_6m DESC
      `, params),
      // por filial
      pool.query(`
        SELECT
          filial,
          COUNT(*)                        AS itens,
          SUM(vlr_vendido_filial_6m)      AS vendas_6m,
          SUM(valor_estoque_filial)       AS valor_estoque,
          ROUND(SUM(lucro_bruto_filial_6m)/NULLIF(SUM(vlr_vendido_filial_6m),0)*100,1) AS margem
        FROM estoque_filiais
        WHERE ${conds.join(' AND ')}
        GROUP BY filial ORDER BY vendas_6m DESC
      `, params),
      // top itens
      pool.query(`
        SELECT referencia, descricao, filial,
          saldo_estoque_filial, vlr_vendido_filial_6m, margem_pct_filial,
          status_cobertura_filial, media_mensal_qtd_filial
        FROM estoque_filiais
        WHERE ${conds.join(' AND ')} AND vlr_vendido_filial_6m > 0
        ORDER BY vlr_vendido_filial_6m DESC LIMIT 20
      `, params),
      // tendência mensal
      pool.query(`
        SELECT
          SUM(vlr_mes6) AS m6, SUM(vlr_mes5) AS m5, SUM(vlr_mes4) AS m4,
          SUM(vlr_mes3) AS m3, SUM(vlr_mes2) AS m2, SUM(vlr_mes1) AS m1
        FROM estoque_filiais WHERE ${conds.join(' AND ')}
      `, params),
    ]);
    const t = tendencia.rows[0] || {};
    res.json({
      grupos:   geral.rows,
      porFilial: porFilial.rows,
      topItens:  topItens.rows,
      tendencia: [
        { mes:'Ago/25', vendas:+t.m6||0 }, { mes:'Set/25', vendas:+t.m5||0 },
        { mes:'Out/25', vendas:+t.m4||0 }, { mes:'Nov/25', vendas:+t.m3||0 },
        { mes:'Dez/25', vendas:+t.m2||0 }, { mes:'Jan/26', vendas:+t.m1||0 },
      ],
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/kpis/lista-grupos ──────────────────────────────
router.get('/lista-grupos', authMiddleware, async (req, res) => {
  const { filial } = req.query;
  const where  = filial && filial !== 'Todas' ? 'WHERE filial = $1' : '';
  const params = filial && filial !== 'Todas' ? [filial] : [];
  try {
    const { rows } = await pool.query(`
      SELECT
        grupo,
        COUNT(*)                        AS total_itens,
        COUNT(DISTINCT filial)          AS lojas,
        SUM(valor_estoque_filial)       AS valor_estoque,
        SUM(vlr_vendido_filial_6m)      AS vendas_6m,
        SUM(lucro_bruto_filial_6m)      AS lucro_6m,
        ROUND(SUM(lucro_bruto_filial_6m)/NULLIF(SUM(vlr_vendido_filial_6m),0)*100,1) AS margem_real,
        COUNT(*) FILTER (WHERE status_cobertura_filial='CRITICO')  AS criticos,
        COUNT(*) FILTER (WHERE status_cobertura_filial='EXCESSO')  AS excesso,
        COUNT(*) FILTER (WHERE status_cobertura_filial='ADEQUADO') AS adequado
      FROM estoque_filiais ${where}
      GROUP BY grupo
      ORDER BY vendas_6m DESC
    `, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
