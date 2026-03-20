// routes/produtos.js — CRUD e listagem de produtos
const express = require('express');
const pool    = require('../db');
const { authMiddleware } = require('./auth');

const router = express.Router();

// ─── GET /api/produtos ────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const {
    page = 0, limit = 15,
    sort = 'valor_estoque', order = 'DESC',
    search = '', unidade, status, grupo
  } = req.query;

  // Whitelist colunas para evitar SQL injection
  const COLS = ['valor_estoque','vlr_saida_6m','margem_pct','lucro_bruto_6m',
                'referencia','grupo','status_cobertura','cobertura_meses','giro_estoque'];
  const sortCol = COLS.includes(sort) ? sort : 'valor_estoque';
  const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const conds = ['1=1'];
  const params = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    conds.push(`(LOWER(referencia) LIKE $${params.length} OR LOWER(descricao) LIKE $${params.length} OR LOWER(grupo) LIKE $${params.length})`);
  }
  if (unidade && unidade !== 'Todas') {
    params.push(unidade);
    conds.push(`unidade = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conds.push(`status_cobertura = $${params.length}`);
  }
  if (grupo) {
    params.push(grupo);
    conds.push(`grupo = $${params.length}`);
  }

  const where = conds.join(' AND ');
  const offset = parseInt(page) * parseInt(limit);
  params.push(parseInt(limit), offset);

  try {
    const [dataRes, countRes] = await Promise.all([
      pool.query(`
        SELECT
          referencia, descricao, grupo, sub_grupo, unidade,
          status_cobertura, saldo_estoque, valor_estoque,
          vlr_saida_6m, lucro_bruto_6m, margem_pct,
          cobertura_meses, giro_estoque, fornecedor_ult,
          dias_sem_compra, status_produto
        FROM produtos
        WHERE ${where}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT $${params.length-1} OFFSET $${params.length}
      `, params),
      pool.query(`SELECT COUNT(*) FROM produtos WHERE ${where}`, params.slice(0,-2))
    ]);

    res.json({
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Erro produtos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/produtos/grupos ─────────────────────────────────
router.get('/grupos', authMiddleware, async (req, res) => {
  const { unidade } = req.query;
  const conds = ['1=1'];
  const params = [];
  if (unidade && unidade !== 'Todas') {
    params.push(unidade);
    conds.push(`unidade = $${params.length}`);
  }

  try {
    const { rows } = await pool.query(`
      SELECT
        grupo,
        COUNT(*)                   AS total_itens,
        SUM(valor_estoque)         AS valor_estoque,
        SUM(vlr_saida_6m)          AS vlr_saida_6m,
        SUM(lucro_bruto_6m)        AS lucro_bruto_6m,
        SUM(vlr_compra_6m)         AS vlr_compra_6m,
        ROUND(AVG(margem_pct),1)   AS margem_media,
        CASE WHEN SUM(vlr_saida_6m) > 0
          THEN ROUND(SUM(lucro_bruto_6m)/SUM(vlr_saida_6m)*100,1)
          ELSE 0 END               AS margem_pct,
        COUNT(*) FILTER (WHERE status_cobertura='CRITICO')     AS criticos,
        COUNT(*) FILTER (WHERE status_cobertura='SEM ESTOQUE') AS sem_estoque,
        COUNT(*) FILTER (WHERE status_cobertura='EXCESSO')     AS excesso,
        COUNT(*) FILTER (WHERE status_cobertura='ADEQUADO')    AS adequado
      FROM produtos
      WHERE ${conds.join(' AND ')}
      GROUP BY grupo
      ORDER BY vlr_saida_6m DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/produtos/criticos ───────────────────────────────
router.get('/criticos', authMiddleware, async (req, res) => {
  const { unidade, limit = 100 } = req.query;
  const conds = [`status_cobertura = 'CRITICO'`];
  const params = [];
  if (unidade && unidade !== 'Todas') {
    params.push(unidade);
    conds.push(`unidade = $${params.length}`);
  }
  params.push(parseInt(limit));

  try {
    const { rows } = await pool.query(`
      SELECT referencia, descricao, grupo, unidade, valor_estoque,
             vlr_saida_6m, margem_pct, cobertura_meses, saldo_estoque,
             fornecedor_ult, dias_sem_compra
      FROM produtos
      WHERE ${conds.join(' AND ')}
      ORDER BY valor_estoque DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/produtos/unidades ───────────────────────────────
router.get('/unidades', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT unidade FROM produtos WHERE unidade IS NOT NULL ORDER BY unidade`
    );
    res.json(rows.map(r => r.unidade));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
