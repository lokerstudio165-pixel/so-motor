// routes/clientes.js — CRUD e KPIs de clientes
const express = require('express');
const pool    = require('../db');
const { authMiddleware } = require('./auth');
const router  = express.Router();

// ─── GET /api/clientes ────────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  const { search, filial, status, limit = 50, offset = 0 } = req.query;
  const conds = ['1=1'];
  const params = [];

  if (search) { conds.push(`(nome ILIKE $${params.length+1} OR cidade ILIKE $${params.length+1} OR documento ILIKE $${params.length+1})`); params.push(`%${search}%`); }
  if (filial && filial !== 'Todas') { conds.push(`filial_ref = $${params.length+1}`); params.push(filial); }
  if (status) { conds.push(`status = $${params.length+1}`); params.push(status); }

  try {
    const [rows, total] = await Promise.all([
      pool.query(`SELECT * FROM clientes WHERE ${conds.join(' AND ')} ORDER BY total_compras_6m DESC NULLS LAST LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, parseInt(limit), parseInt(offset)]),
      pool.query(`SELECT COUNT(*) FROM clientes WHERE ${conds.join(' AND ')}`, params),
    ]);
    res.json({ ok: true, rows: rows.rows, total: parseInt(total.rows[0].count) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/clientes/kpis ───────────────────────────────────
router.get('/kpis', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                  AS total_clientes,
        COUNT(*) FILTER (WHERE status = 'Ativo')  AS ativos,
        COUNT(*) FILTER (WHERE status = 'Inativo')AS inativos,
        SUM(total_compras_6m)                     AS volume_6m,
        SUM(total_compras_mes)                    AS volume_mes,
        AVG(ticket_medio)                         AS ticket_medio,
        COUNT(DISTINCT cidade)                    AS cidades,
        COUNT(DISTINCT filial_ref)                AS filiais_atendidas
      FROM clientes
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /api/clientes/por-filial ─────────────────────────────
router.get('/por-filial', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        filial_ref,
        COUNT(*)              AS total,
        SUM(total_compras_6m) AS volume_6m,
        AVG(ticket_medio)     AS ticket_medio
      FROM clientes
      GROUP BY filial_ref
      ORDER BY volume_6m DESC NULLS LAST
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /api/clientes ───────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { nome, documento, telefone, email, cidade, estado, filial_ref,
          latitude, longitude, segmento, status = 'Ativo',
          total_compras_6m = 0, total_compras_mes = 0, ticket_medio = 0, observacao } = req.body;
  if (!nome) return res.status(400).json({ ok: false, error: 'Campo "nome" obrigatório.' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO clientes (nome, documento, telefone, email, cidade, estado, filial_ref,
        latitude, longitude, segmento, status, total_compras_6m, total_compras_mes, ticket_medio, observacao)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
    `, [nome, documento, telefone, email, cidade, estado, filial_ref,
        latitude, longitude, segmento, status,
        total_compras_6m, total_compras_mes, ticket_medio, observacao]);
    res.json({ ok: true, cliente: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── PUT /api/clientes/:id ────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const campos = ['nome','documento','telefone','email','cidade','estado','filial_ref',
                  'latitude','longitude','segmento','status','total_compras_6m',
                  'total_compras_mes','ticket_medio','observacao'];
  const sets = [], params = [];
  campos.forEach(c => { if (req.body[c] !== undefined) { params.push(req.body[c]); sets.push(`${c} = $${params.length}`); } });
  if (!sets.length) return res.status(400).json({ ok: false, error: 'Nenhum campo para atualizar.' });
  params.push(id);
  try {
    const { rows } = await pool.query(`UPDATE clientes SET ${sets.join(',')} WHERE id = $${params.length} RETURNING *`, params);
    res.json({ ok: true, cliente: rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── DELETE /api/clientes/:id ─────────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM clientes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
