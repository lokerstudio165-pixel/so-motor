const express = require('express');
const pool = require('../db');
const { authMiddleware } = require('./auth');

const router = express.Router();

const fallbackVehicles = [
  { codigo:'MDM-042', motorista:'Carlos A.', cidade:'Recife', status:'Online', combustivel:78, latitude:-8.0476, longitude:-34.8770, rota:'Recife → Olinda', receita:182.40, ultimo_sinal:'13/03/2026 08:42' },
  { codigo:'MDM-018', motorista:'Marina S.', cidade:'Jaboatão', status:'Em rota', combustivel:64, latitude:-8.1120, longitude:-35.0150, rota:'Jaboatão → Recife', receita:96.20, ultimo_sinal:'13/03/2026 08:11' },
  { codigo:'MDM-011', motorista:'João P.', cidade:'Petrolina', status:'Alerta', combustivel:29, latitude:-9.3891, longitude:-40.5030, rota:'Petrolina → Juazeiro', receita:211.00, ultimo_sinal:'13/03/2026 07:34' },
  { codigo:'MDM-063', motorista:'Lia M.', cidade:'Paulista', status:'Online', combustivel:53, latitude:-7.9408, longitude:-34.8731, rota:'Paulista → Recife', receita:58.30, ultimo_sinal:'13/03/2026 07:12' },
  { codigo:'MDM-077', motorista:'Rafael T.', cidade:'Caruaru', status:'Online', combustivel:71, latitude:-8.2836, longitude:-35.9761, rota:'Caruaru → Bezerros', receita:74.90, ultimo_sinal:'13/03/2026 07:58' },
  { codigo:'MDM-091', motorista:'Bianca F.', cidade:'Olinda', status:'Em rota', combustivel:47, latitude:-8.0089, longitude:-34.8553, rota:'Olinda → Recife', receita:134.50, ultimo_sinal:'13/03/2026 08:27' },
];

async function hasFleetTable() {
  const { rows } = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'veiculos_frota'
    ) AS exists
  `);
  return rows[0]?.exists;
}

router.get('/painel', authMiddleware, async (req, res) => {
  try {
    if (!(await hasFleetTable())) {
      return res.json({ source: 'fallback', vehicles: fallbackVehicles });
    }

    const { rows } = await pool.query(`
      SELECT
        codigo,
        motorista,
        cidade,
        status,
        combustivel,
        latitude,
        longitude,
        rota,
        receita,
        TO_CHAR(ultimo_sinal, 'DD/MM/YYYY HH24:MI') AS ultimo_sinal
      FROM veiculos_frota
      ORDER BY ultimo_sinal DESC, codigo ASC
    `);

    res.json({ source: 'database', vehicles: rows });
  } catch (err) {
    console.error('Erro frota/painel:', err.message);
    res.status(500).json({ error: 'Erro ao carregar painel de frota' });
  }
});

module.exports = router;
