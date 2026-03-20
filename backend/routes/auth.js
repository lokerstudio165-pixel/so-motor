// routes/auth.js — Autenticação JWT
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'somotor_secret';

// ─── MIDDLEWARE: Verifica token ────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ─── MIDDLEWARE: Apenas admin ──────────────────────────────────
function adminOnly(req, res, next) {
  if (req.user.perfil !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
}

// ─── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE',
      [email.toLowerCase().trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    const user = rows[0];
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }
    // Atualiza último login
    await pool.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil, unidade: user.unidade },
      SECRET,
      { expiresIn: '8h' }
    );
    res.json({
      token,
      user: { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil, unidade: user.unidade }
    });
  } catch (err) {
    console.error('Erro login:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ─── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ─── GET /api/auth/usuarios (admin) ───────────────────────────
router.get('/usuarios', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nome, email, perfil, unidade, ativo, criado_em, ultimo_login FROM usuarios ORDER BY nome'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/usuarios (admin) ──────────────────────────
router.post('/usuarios', authMiddleware, adminOnly, async (req, res) => {
  const { nome, email, senha, perfil, unidade } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }
  try {
    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, unidade)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, email, perfil, unidade`,
      [nome, email.toLowerCase().trim(), hash, perfil || 'viewer', unidade || 'Todas']
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/auth/usuarios/:id (admin) ────────────────────
router.delete('/usuarios/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE usuarios SET ativo = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, authMiddleware };
